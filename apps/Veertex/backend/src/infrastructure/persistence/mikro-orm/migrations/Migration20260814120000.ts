import { Migration } from '@mikro-orm/migrations';

/**
 * CONTATOS — §3.4 do CORE. Quatro tabelas, todas de TENANT.
 *
 * `contacts` e três filhas (`contact_emails`, `contact_phones`, `contact_addresses`). Cada uma
 * carrega `account_id NOT NULL` e tem **policy de RLS própria** — decisão de Eliab, 14/08/2026.
 *
 * **Por que a filha não herda o isolamento do pai:** RLS não segue JOIN. Uma policy só em `contacts`
 * protegeria `select * from contacts join contact_phones ...`, e não protegeria
 * `select * from contact_phones` — que é uma query legítima que qualquer código futuro pode
 * escrever, e que devolveria os telefones de todas as contas. O `verify:isolation` recusa tabela com
 * `account_id` e sem policy justamente para tornar esse desenho impossível de esquecer.
 *
 * ⚠️ **Não há coluna de vendedor vinculado (carteirização).** Decisão registrada na entidade de
 * domínio: coluna sem o filtro que a aplica é a pior configuração possível, porque alguém depois
 * supõe que ela restringe algo. A carteirização volta inteira — coluna, preferência, filtro pelo
 * `sub` do token e teste de isolamento por ator — junto com o módulo que precisar dela.
 *
 * Migration ADITIVA: só cria. Nada é apagado, nada é alterado em tabela existente.
 */
export class Migration20260814120000 extends Migration {
  async up(): Promise<void> {
    // ── contacts ───────────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "contacts" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "types" text[] not null,
        "person_kind" varchar(20) not null,
        "legal_name" varchar(200) not null,
        "trade_name" varchar(200) null,
        "document" varchar(14) null,
        "state_registration" varchar(30) null,
        "code" varchar(30) null,
        "credit_limit" numeric(14,2) null,
        "notes" text null,
        "municipal_registration" varchar(30) null,
        "suframa" varchar(30) null,
        "gln" varchar(30) null,
        "pix_key" varchar(140) null,
        "website" varchar(200) null,
        "active" boolean not null default true,
        constraint "contacts_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "contacts" add constraint "contacts_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "contacts_account_id_index" on "contacts" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "contacts_legal_name_index" on "contacts" ("legal_name");`,
    );

    /*
     * GIN em `types` — a decisão do array em vez de tabela de junção (Eliab, 14/08/2026).
     *
     * O filtro da tela é "contatos que SÃO clientes", que em SQL é `types @> ARRAY['customer']`.
     * Sem o GIN isso é varredura completa; com ele, o índice atende diretamente. É o que paga a
     * escolha do array: o join que a tabela de junção cobraria em toda listagem não existe.
     */
    this.addSql(
      `create index if not exists "contacts_types_gin" on "contacts" using gin ("types");`,
    );

    /*
     * Únicos PARCIAIS por conta — o mesmo padrão das demais tabelas: linha soft-deletada não pode
     * impedir o recadastro do mesmo documento depois. E `where ... is not null` porque documento e
     * código são opcionais: sem isso, dois contatos sem documento colidiriam entre si.
     */
    this.addSql(`
      create unique index if not exists "contacts_account_document_unique"
        on "contacts" ("account_id", "document")
        where "deleted_at" is null and "document" is not null;
    `);
    this.addSql(`
      create unique index if not exists "contacts_account_code_unique"
        on "contacts" ("account_id", "code")
        where "deleted_at" is null and "code" is not null;
    `);

    // ── contact_emails ─────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "contact_emails" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "contact_id" uuid not null,
        "email" varchar(255) not null,
        "label" varchar(60) null,
        constraint "contact_emails_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "contact_emails" add constraint "contact_emails_contact_id_foreign"
         foreign key ("contact_id") references "contacts" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "contact_emails" add constraint "contact_emails_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "contact_emails_account_id_index" on "contact_emails" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "contact_emails_contact_id_index" on "contact_emails" ("contact_id");`,
    );

    // ── contact_phones ─────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "contact_phones" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "contact_id" uuid not null,
        "phone" varchar(20) not null,
        "label" varchar(60) null,
        "is_whatsapp" boolean not null default false,
        constraint "contact_phones_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "contact_phones" add constraint "contact_phones_contact_id_foreign"
         foreign key ("contact_id") references "contacts" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "contact_phones" add constraint "contact_phones_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "contact_phones_account_id_index" on "contact_phones" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "contact_phones_contact_id_index" on "contact_phones" ("contact_id");`,
    );
    // Busca por telefone é o caso de uso do balcão — ver o docblock da entidade ORM.
    this.addSql(
      `create index if not exists "contact_phones_phone_index" on "contact_phones" ("phone");`,
    );

    // ── contact_addresses ──────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "contact_addresses" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "contact_id" uuid not null,
        "purpose" varchar(20) not null,
        "street" varchar(200) not null,
        "number" varchar(20) not null,
        "complement" varchar(100) null,
        "district" varchar(100) not null,
        "city" varchar(120) not null,
        "state" varchar(2) not null,
        "zip_code" varchar(8) not null,
        "ibge_city_code" varchar(7) null,
        "latitude" numeric(10,7) null,
        "longitude" numeric(10,7) null,
        constraint "contact_addresses_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "contact_addresses" add constraint "contact_addresses_contact_id_foreign"
         foreign key ("contact_id") references "contacts" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "contact_addresses" add constraint "contact_addresses_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "contact_addresses_account_id_index" on "contact_addresses" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "contact_addresses_contact_id_index" on "contact_addresses" ("contact_id");`,
    );

    // ── RLS: uma policy por tabela, sem exceção ────────────────────────────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    for (const table of ['contacts', 'contact_emails', 'contact_phones', 'contact_addresses']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }

    // ── Grants ao papel de runtime ─────────────────────────────────────────────────────────────
    // Condicional, como nas migrations anteriores: ambiente de desenvolvimento com um usuário só
    // precisa migrar sem falhar num GRANT para papel que nunca criou.
    //
    // ⚠️ SEM DELETE — nem para as tabelas filhas, e a ausência é deliberada.
    //
    // A sincronização das coleções (substituir e-mails/telefones/endereços a cada gravação) pedia
    // `DELETE`, e conceder teria quebrado o invariante que o `verify:isolation` verifica: *"o papel
    // de runtime não tem DELETE"*. Esse invariante não é preferência de estilo — é o que garante que
    // uma falha na aplicação não consiga apagar dado de cliente, e enfraquecê-lo para facilitar um
    // formulário seria trocar uma proteção real por conveniência de implementação.
    //
    // A saída foi soft-delete também nas filhas: a linha antiga recebe `deleted_at` e some pelo
    // filtro global. O custo é lixo invisível (um contato editado 50 vezes deixa linhas mortas), e é
    // o mesmo custo que o resto do sistema já paga em toda tabela de negócio.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.contacts to veertex_app;
          grant select, insert, update on table public.contact_emails to veertex_app;
          grant select, insert, update on table public.contact_phones to veertex_app;
          grant select, insert, update on table public.contact_addresses to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    // Ordem inversa da criação: as filhas primeiro, por causa das FKs.
    this.addSql(`drop table if exists "contact_addresses" cascade;`);
    this.addSql(`drop table if exists "contact_phones" cascade;`);
    this.addSql(`drop table if exists "contact_emails" cascade;`);
    this.addSql(`drop table if exists "contacts" cascade;`);
  }
}
