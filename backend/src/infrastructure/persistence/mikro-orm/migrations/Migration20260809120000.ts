import { Migration } from '@mikro-orm/migrations';

/**
 * F2 — modularidade: `modules` (catálogo global) e `account_modules` (ativação por conta).
 *
 * `modules` acompanha `plans`: global, sem `account_id`, leitura liberada e escrita só do dono.
 * `account_modules` é tabela de negócio como qualquer outra — RLS ligado, policy por `account_id`,
 * soft delete. O verificador de invariantes descobre a nova tabela sozinho, porque a lista dele sai
 * de `pg_attribute` (quem tem `account_id`) e não de uma lista fixa; se esta migration esquecesse a
 * policy, o boot abortaria em vez de subir com uma tabela desprotegida.
 *
 * O catálogo de módulos NÃO é populado aqui — quem popula é o seed idempotente do boot
 * (`module-catalog.seed.ts`), pelo mesmo motivo dos planos: catálogo é dado, e mantê-lo também numa
 * migration criaria duas fontes de verdade que divergem na primeira alteração.
 */
export class Migration20260809120000 extends Migration {
  async up(): Promise<void> {
    // ── modules: catálogo global ───────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "modules" (
        "id" uuid not null,
        "code" varchar(20) not null,
        "name" varchar(120) not null,
        "description" varchar(300) not null default '',
        "depends_on" jsonb not null default '[]'::jsonb,
        "core" boolean not null default false,
        "created_at" timestamptz not null default now(),
        constraint "modules_pkey" primary key ("id"),
        constraint "modules_code_unique" unique ("code")
      );
    `);

    // ── account_modules: ativação por conta ────────────────────────────────────────────────────
    //
    // A FK aponta para `modules(code)` e não para `modules(id)`: o código é a chave estável e
    // legível, e evita um join na leitura de "quais módulos esta conta tem" — que roda a cada login
    // e a cada refresh.
    this.addSql(`
      create table if not exists "account_modules" (
        "id" uuid not null,
        "account_id" uuid not null,
        "module_code" varchar(20) not null,
        "active" boolean not null default true,
        "activated_at" timestamptz null,
        "deactivated_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "account_modules_pkey" primary key ("id"),
        constraint "account_modules_account_id_foreign" foreign key ("account_id") references "accounts" ("id"),
        constraint "account_modules_module_code_foreign" foreign key ("module_code") references "modules" ("code")
      );
    `);
    this.addSql(`
      create index if not exists "account_modules_account_id_index"
        on "account_modules" ("account_id");
    `);
    // Cobre a leitura de caminho quente: os códigos ativos da conta, no login e no refresh.
    this.addSql(`
      create index if not exists "account_modules_account_active_index"
        on "account_modules" ("account_id", "active") where "deleted_at" is null;
    `);
    // Único PARCIAL, como nas demais: uma linha soft-deletada não pode impedir a reativação futura
    // do mesmo módulo na mesma conta.
    this.addSql(`
      create unique index if not exists "account_modules_account_module_unique"
        on "account_modules" ("account_id", "module_code") where "deleted_at" is null;
    `);

    // ── RLS ────────────────────────────────────────────────────────────────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`alter table "account_modules" enable row level security;`);
    this.addSql(`drop policy if exists "account_modules_tenant_isolation" on "account_modules";`);
    this.addSql(`
      create policy "account_modules_tenant_isolation" on "account_modules"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);

    // Catálogo público da plataforma: leitura liberada, escrita só pelo dono — igual a `plans`.
    this.addSql(`alter table "modules" enable row level security;`);
    this.addSql(`drop policy if exists "modules_read_all" on "modules";`);
    this.addSql(`create policy "modules_read_all" on "modules" for select using (true);`);

    // ── Grants ao papel de runtime ─────────────────────────────────────────────────────────────
    // Condicional pelo mesmo motivo da migration da F1: um ambiente de desenvolvimento com um
    // usuário só precisa conseguir migrar sem falhar num GRANT para papel que nunca criou.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select on table public.modules to veertex_app;
          grant select, insert, update on table public.account_modules to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "account_modules" cascade;`);
    this.addSql(`drop table if exists "modules" cascade;`);
  }
}
