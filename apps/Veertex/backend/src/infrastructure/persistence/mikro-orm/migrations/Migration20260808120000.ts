import { Migration } from '@mikro-orm/migrations';

/**
 * F1 — fundação multi-tenant e identidade.
 *
 * Cria `plans`, `accounts`, `companies`, `roles`, `users` e `password_reset_codes`, liga o
 * Row Level Security, publica a função de autenticação e concede ao papel de runtime exatamente o
 * que ele precisa — nada além.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * SOBRE O RLS: `ENABLE`, e NÃO `FORCE` — mudança em relação ao plano aprovado, com motivo
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `FORCE ROW LEVEL SECURITY` sujeita também o DONO da tabela às policies. O plano F1 previa FORCE,
 * mas ao implementar ficou claro que ele quebra três caminhos legítimos e não protege nada a mais:
 *
 *   - a aplicação NUNCA conecta como dono (ela usa `veertex_app`), e para um papel que não é dono
 *     o `ENABLE` já aplica as policies integralmente. É disso que depende o critério de aceite
 *     §7.2, e ele continua satisfeito;
 *   - com FORCE, a própria migration não conseguiria ler/backfillar linhas de vários tenants;
 *   - com FORCE, a função `SECURITY DEFINER` de autenticação (abaixo) também seria barrada, porque
 *     roda como o dono. A alternativa seria criar um papel com `BYPASSRLS` só para ela — um papel
 *     que ignora RLS por completo, superfície maior do que a que FORCE fecharia.
 *
 * Ou seja: FORCE só protegeria contra queries feitas COM as credenciais de dono, que só existem no
 * deploy e no CLI de operador. Trocamos isso por um caminho de autenticação auditável.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * COMO O ESCOPO CHEGA AQUI
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `TenantScopeSubscriber` executa `set_config('app.account_id', <id>, true)` no início de CADA
 * transação (transaction-local — sessão vazaria entre conexões do pool). As policies leem esse
 * valor. Sem escopo o valor é string vazia, o `nullif(...)` vira NULL, e `account_id = NULL` não
 * casa com linha nenhuma: consulta sem escopo lê ZERO linhas, nunca todas.
 */
export class Migration20260808120000 extends Migration {
  async up(): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 1. Tabelas
    // ═══════════════════════════════════════════════════════════════════════════════════════

    // `plans` é global (catálogo da plataforma) — sem account_id.
    this.addSql(`
      create table if not exists "plans" (
        "id" uuid not null,
        "code" varchar(30) not null,
        "name" varchar(120) not null,
        "limits" jsonb not null default '{}'::jsonb,
        "active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        constraint "plans_pkey" primary key ("id"),
        constraint "plans_code_unique" unique ("code")
      );
    `);

    // `accounts` É o tenant: o próprio id é o escopo, por isso não há account_id aqui.
    this.addSql(`
      create table if not exists "accounts" (
        "id" uuid not null,
        "name" varchar(200) not null,
        "document" varchar(14) not null,
        "plan_id" uuid not null,
        "status" varchar(20) not null default 'ACTIVE',
        "timezone" varchar(64) not null default 'America/Sao_Paulo',
        "suspended_at" timestamptz null,
        "suspension_reason" varchar(500) null,
        "cancellation_requested_at" timestamptz null,
        "cancelled_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "accounts_pkey" primary key ("id"),
        constraint "accounts_document_unique" unique ("document"),
        constraint "accounts_status_check" check ("status" in ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
        constraint "accounts_plan_id_foreign" foreign key ("plan_id") references "plans" ("id")
      );
    `);
    this.addSql(`create index if not exists "accounts_status_index" on "accounts" ("status");`);
    this.addSql(`create index if not exists "accounts_plan_id_index" on "accounts" ("plan_id");`);

    this.addSql(`
      create table if not exists "companies" (
        "id" uuid not null,
        "account_id" uuid not null,
        "legal_name" varchar(200) not null,
        "trade_name" varchar(200) null,
        "document" varchar(14) not null,
        "state_registration" varchar(30) null,
        "state_registration_exempt" boolean not null default false,
        "municipal_registration" varchar(30) null,
        "suframa" varchar(30) null,
        "cnae" varchar(10) null,
        "tax_regime" varchar(20) not null,
        "address_street" varchar(200) not null,
        "address_number" varchar(20) not null,
        "address_complement" varchar(100) null,
        "address_district" varchar(100) not null,
        "address_city" varchar(120) not null,
        "address_state" varchar(2) not null,
        "address_zip_code" varchar(8) not null,
        "address_ibge_city_code" varchar(7) null,
        "contact_email" varchar(255) null,
        "billing_email" varchar(255) null,
        "phone" varchar(20) null,
        "st_registrations" jsonb not null default '[]'::jsonb,
        "logo_object_key" varchar(300) null,
        "active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "companies_pkey" primary key ("id"),
        constraint "companies_tax_regime_check" check ("tax_regime" in ('SIMPLES', 'NORMAL', 'MEI')),
        constraint "companies_account_id_foreign" foreign key ("account_id") references "accounts" ("id")
      );
    `);
    this.addSql(
      `create index if not exists "companies_account_id_index" on "companies" ("account_id");`,
    );
    // Índice único PARCIAL: uma empresa excluída (soft delete) não pode impedir que o mesmo CNPJ
    // seja cadastrado de novo — com unique comum, o CNPJ ficaria queimado para sempre.
    this.addSql(`
      create unique index if not exists "companies_account_document_unique"
        on "companies" ("account_id", "document") where "deleted_at" is null;
    `);

    this.addSql(`
      create table if not exists "roles" (
        "id" uuid not null,
        "account_id" uuid not null,
        "code" varchar(30) not null,
        "name" varchar(60) not null,
        "description" varchar(300) null,
        "permissions" jsonb not null default '[]'::jsonb,
        "is_system" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "roles_pkey" primary key ("id"),
        constraint "roles_account_id_foreign" foreign key ("account_id") references "accounts" ("id")
      );
    `);
    this.addSql(`create index if not exists "roles_account_id_index" on "roles" ("account_id");`);
    this.addSql(`
      create unique index if not exists "roles_account_code_unique"
        on "roles" ("account_id", "code") where "deleted_at" is null;
    `);
    // Sustenta countAdministrative() — a checagem de "ainda existe quem administre a conta".
    this.addSql(
      `create index if not exists "roles_permissions_gin" on "roles" using gin ("permissions");`,
    );

    this.addSql(`
      create table if not exists "users" (
        "id" uuid not null,
        "account_id" uuid not null,
        "name" varchar(200) not null,
        "email" varchar(255) not null,
        "phone" varchar(20) not null,
        "password_hash" varchar(100) not null,
        "role_id" uuid not null,
        "status" varchar(20) not null default 'ACTIVE',
        "access_windows" jsonb null,
        "last_login_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "users_pkey" primary key ("id"),
        constraint "users_status_check" check ("status" in ('ACTIVE', 'DISABLED')),
        constraint "users_account_id_foreign" foreign key ("account_id") references "accounts" ("id"),
        constraint "users_role_id_foreign" foreign key ("role_id") references "roles" ("id")
      );
    `);
    // "phone" é NOT NULL desde a PRIMEIRA migration. A exceção da regra 9 do CLAUDE.md (coluna
    // nullable) vale só para tabela que JÁ tem linhas — o Veertex nasce agora, então não se aplica.
    this.addSql(`create index if not exists "users_account_id_index" on "users" ("account_id");`);
    this.addSql(`create index if not exists "users_role_id_index" on "users" ("role_id");`);
    this.addSql(`
      create unique index if not exists "users_account_email_unique"
        on "users" ("account_id", "email") where "deleted_at" is null;
    `);
    // Sustenta a função de autenticação, que busca por e-mail sem saber o tenant.
    this.addSql(`
      create index if not exists "users_email_active_index"
        on "users" ("email") where "deleted_at" is null;
    `);

    this.addSql(`
      create table if not exists "password_reset_codes" (
        "id" uuid not null,
        "account_id" uuid not null,
        "user_id" uuid not null,
        "code_hash" varchar(100) not null,
        "expires_at" timestamptz not null,
        "attempts" smallint not null default 0,
        "consumed_at" timestamptz null,
        "sent_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "password_reset_codes_pkey" primary key ("id"),
        constraint "password_reset_codes_account_id_foreign" foreign key ("account_id") references "accounts" ("id"),
        constraint "password_reset_codes_user_id_foreign" foreign key ("user_id") references "users" ("id")
      );
    `);
    this.addSql(`
      create index if not exists "password_reset_codes_account_id_index"
        on "password_reset_codes" ("account_id");
    `);
    // Um índice para as duas leituras do fluxo: o código vivo do usuário e a cota por hora.
    this.addSql(`
      create index if not exists "password_reset_codes_user_created_index"
        on "password_reset_codes" ("user_id", "created_at" desc);
    `);

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 2. Row Level Security
    // ═══════════════════════════════════════════════════════════════════════════════════════
    //
    // O padrão do escopo: nullif(current_setting('app.account_id', true), '')::uuid
    //   - o segundo argumento `true` de current_setting = missing_ok: devolve NULL se a variável
    //     nunca foi definida, em vez de levantar erro;
    //   - o nullif transforma a string vazia (transação sem escopo) em NULL;
    //   - comparar com NULL devolve NULL, que não é TRUE → nenhuma linha passa. Falha fechada.

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    for (const table of ['companies', 'roles', 'users', 'password_reset_codes']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }

    // `accounts` compara o PRÓPRIO id: um request autenticado enxerga a sua conta e nenhuma outra.
    this.addSql(`alter table "accounts" enable row level security;`);
    this.addSql(`drop policy if exists "accounts_tenant_isolation" on "accounts";`);
    this.addSql(`
      create policy "accounts_tenant_isolation" on "accounts"
        for all
        using ("id" = ${tenantScope})
        with check ("id" = ${tenantScope});
    `);

    // `plans` é catálogo público da plataforma: leitura liberada, escrita só pelo dono. "Global"
    // não pode significar "sem policy" — sem RLS ligado, um GRANT errado no futuro abriria escrita.
    this.addSql(`alter table "plans" enable row level security;`);
    this.addSql(`drop policy if exists "plans_read_all" on "plans";`);
    this.addSql(`create policy "plans_read_all" on "plans" for select using (true);`);

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 3. A função de autenticação — o ÚNICO caminho que cruza tenants em runtime
    // ═══════════════════════════════════════════════════════════════════════════════════════
    //
    // No login não existe JWT, logo não existe escopo, logo o RLS de `users` devolveria zero linhas
    // — e o e-mail é o único identificador disponível. Em vez de enfraquecer a policy ou dar bypass
    // ao papel de runtime, exatamente UMA função, com lista de colunas fixa, atravessa a fronteira.
    //
    // `security definer` faz a função rodar como o dono (que não está sujeito ao RLS, ver nota do
    // topo). `search_path` fixo é obrigatório numa função definer: sem isso, um schema plantado no
    // search_path do chamador poderia sequestrar a resolução de nomes dentro dela.
    this.addSql(`
      create or replace function "veertex_auth_find_user_by_email"(p_email text)
      returns table (
        id uuid,
        account_id uuid,
        name varchar(200),
        email varchar(255),
        phone varchar(20),
        password_hash varchar(100),
        role_id uuid,
        status varchar(20),
        access_windows jsonb,
        last_login_at timestamptz,
        created_at timestamptz
      )
      language sql
      stable
      security definer
      set search_path = pg_catalog, public
      as $$
        select u.id, u.account_id, u.name, u.email, u.phone, u.password_hash,
               u.role_id, u.status, u.access_windows, u.last_login_at, u.created_at
        from public.users u
        where u.email = lower(trim(p_email))
          and u.deleted_at is null
        limit 1;
      $$;
    `);
    // Uma função definer é PUBLIC-executável por padrão. Revogar e conceder só a quem precisa é o
    // que impede que ela vire uma porta aberta a qualquer papel futuro do banco.
    this.addSql(`revoke all on function "veertex_auth_find_user_by_email"(text) from public;`);

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 4. Grants ao papel de runtime — menor privilégio, concedido tabela a tabela
    // ═══════════════════════════════════════════════════════════════════════════════════════
    //
    // Condicional porque o papel é criado fora daqui (deploy/sql/001_create_roles.sql), e um
    // ambiente de desenvolvimento com um único usuário deve conseguir rodar as migrations mesmo
    // assim — sem falhar num GRANT para um papel que ele nunca criou.
    //
    // Repare no que NÃO é concedido: nenhum DELETE (exclusão é soft delete, um UPDATE), nenhum
    // TRUNCATE, nenhum DDL, e em `plans` apenas SELECT.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant usage on schema public to veertex_app;
          grant select on table public.plans to veertex_app;
          grant select, insert, update on table
            public.accounts, public.companies, public.roles,
            public.users, public.password_reset_codes
            to veertex_app;
          grant execute on function public.veertex_auth_find_user_by_email(text) to veertex_app;
        end if;
      end
      $$;
    `);

    // ═══════════════════════════════════════════════════════════════════════════════════════
    // 5. Catálogo de planos — deliberadamente NÃO está aqui
    // ═══════════════════════════════════════════════════════════════════════════════════════
    //
    // Plano é DADO, não schema. Quem o popula é o seed idempotente do boot
    // (`plan-catalog.seed.ts`), que roda a cada inicialização e reconcilia o catálogo.
    //
    // Motivo de não duplicar: com o seed no boot, manter os mesmos INSERTs também aqui criaria
    // duas fontes de verdade. Na primeira alteração comercial de teto ou de módulos elas
    // divergiriam, e um banco novo passaria a nascer diferente de um banco existente — com a
    // diferença aparecendo só quando alguém tentasse criar uma conta.
  }

  async down(): Promise<void> {
    this.addSql(`drop function if exists "veertex_auth_find_user_by_email"(text);`);
    this.addSql(`drop table if exists "password_reset_codes" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
    this.addSql(`drop table if exists "roles" cascade;`);
    this.addSql(`drop table if exists "companies" cascade;`);
    this.addSql(`drop table if exists "accounts" cascade;`);
    this.addSql(`drop table if exists "plans" cascade;`);
  }
}
