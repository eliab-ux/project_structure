import { Migration } from '@mikro-orm/migrations';

/**
 * `field_configs` (§3.6) + preferências da conta (§1 do 01A). Migration ADITIVA: cria uma tabela e
 * acrescenta colunas; não altera nem apaga dado existente.
 *
 * ## `field_configs` — tabela de TENANT
 *
 * Carrega `account_id NOT NULL` e tem **policy de RLS própria**, como toda tabela de negócio. O
 * `verify:isolation` a descobre sozinho (deriva o conjunto de tabelas de tenant do schema, por
 * `account_id`), então não é preciso registrá-la em lista nenhuma — basta a policy existir, e ela
 * existe aqui, no mesmo commit da tabela (exigência do 01A).
 *
 * Único parcial por `(account_id, entity, field)` onde `deleted_at is null`: uma conta tem no
 * máximo uma config viva por campo, e uma linha soft-deletada (a substituição do `SetFieldConfig`
 * grava por soft-delete, pois o runtime não tem DELETE) não impede a próxima.
 *
 * ## Preferências — colunas nomeadas em `accounts`, com default declarado
 *
 * Três colunas `NOT NULL DEFAULT` (§1 do 01A: coluna nomeada, não jsonb). O DEFAULT no banco é o
 * mesmo valor conservador declarado no VO `AccountPreferences` — uma conta que já exista recebe o
 * default no backfill, e nasce com o comportamento que já tinha (documento não duplicado, numeração
 * manual). Não há passo transitório nullable: o default torna a coluna NOT NULL desde já.
 */
export class Migration20260822120000 extends Migration {
  async up(): Promise<void> {
    // ── field_configs ──────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "field_configs" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "entity" varchar(40) not null,
        "field" varchar(80) not null,
        "visible" boolean not null,
        "required" boolean not null,
        "label" varchar(100) null,
        "sort_order" int null,
        constraint "field_configs_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "field_configs" add constraint "field_configs_account_id_foreign"
         foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `create index if not exists "field_configs_account_id_index" on "field_configs" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "field_configs_entity_index" on "field_configs" ("entity");`,
    );
    this.addSql(`
      create unique index if not exists "field_configs_account_entity_field_unique"
        on "field_configs" ("account_id", "entity", "field")
        where "deleted_at" is null;
    `);

    // ── RLS: policy própria, mesmo padrão das demais tabelas de tenant ──────────────────────────
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "field_configs" enable row level security;`);
    this.addSql(`drop policy if exists "field_configs_tenant_isolation" on "field_configs";`);
    this.addSql(`
      create policy "field_configs_tenant_isolation" on "field_configs"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);

    // ── Grants ao papel de runtime — SEM DELETE (a substituição é soft-delete) ─────────────────
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.field_configs to veertex_app;
        end if;
      end
      $$;
    `);

    // ── Preferências da conta em `accounts` ────────────────────────────────────────────────────
    this.addSql(`
      alter table "accounts"
        add column if not exists "allow_duplicate_document" boolean not null default false,
        add column if not exists "contact_code_mode" varchar(20) not null default 'manual',
        add column if not exists "product_sku_mode" varchar(20) not null default 'manual';
    `);
    this.addSql(`
      alter table "accounts"
        drop constraint if exists "accounts_contact_code_mode_check";
    `);
    this.addSql(`
      alter table "accounts"
        add constraint "accounts_contact_code_mode_check"
        check ("contact_code_mode" in ('manual', 'sequential'));
    `);
    this.addSql(`
      alter table "accounts"
        drop constraint if exists "accounts_product_sku_mode_check";
    `);
    this.addSql(`
      alter table "accounts"
        add constraint "accounts_product_sku_mode_check"
        check ("product_sku_mode" in ('manual', 'sequential'));
    `);
  }

  async down(): Promise<void> {
    this.addSql(
      `alter table "accounts" drop constraint if exists "accounts_product_sku_mode_check";`,
    );
    this.addSql(
      `alter table "accounts" drop constraint if exists "accounts_contact_code_mode_check";`,
    );
    this.addSql(`
      alter table "accounts"
        drop column if exists "product_sku_mode",
        drop column if exists "contact_code_mode",
        drop column if exists "allow_duplicate_document";
    `);
    this.addSql(`drop table if exists "field_configs" cascade;`);
  }
}
