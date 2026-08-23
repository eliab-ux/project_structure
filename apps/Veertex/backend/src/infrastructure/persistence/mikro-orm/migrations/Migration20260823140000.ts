import { Migration } from '@mikro-orm/migrations';

/**
 * ROT fatia 4 (§04, acerto) — `trip_collections` (carteira: título×viagem, cobrança|recobrança) +
 * `field_receipts` (recebimento em campo, dois estágios) + `accounts.rot_recollection_limit`
 * (limiar da política "perdida": 1 cobrança + N recobranças, N configurável, default 3).
 * Tabelas de TENANT com RLS (cobertas pelo `verify:isolation`). A carteira é APPEND (montagem
 * idempotente, sem update); o recebimento tem os dois estágios → grant COM update, SEM delete.
 */
export class Migration20260823140000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      alter table "accounts"
        add column if not exists "rot_recollection_limit" int not null default 3;
    `);

    // ── trip_collections ────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "trip_collections" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "trip_id" uuid not null,
        "title_id" uuid not null,
        "kind" varchar(12) not null,
        "amount_at_build" numeric(14,2) not null,
        constraint "trip_collections_pkey" primary key ("id"),
        constraint "trip_collections_kind_check" check ("kind" in ('cobranca','recobranca')),
        constraint "trip_collections_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "trip_collections_trip_foreign" foreign key ("trip_id") references "trips" ("id") on update cascade on delete cascade,
        constraint "trip_collections_title_foreign" foreign key ("title_id") references "financial_titles" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "trip_collections_account_id_index" on "trip_collections" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "trip_collections_trip_index" on "trip_collections" ("trip_id");`,
    );
    this.addSql(
      `create index if not exists "trip_collections_title_index" on "trip_collections" ("title_id");`,
    );
    // Um título entra UMA vez na carteira de cada viagem (idempotência da montagem).
    this.addSql(`
      create unique index if not exists "trip_collections_trip_title_unique"
        on "trip_collections" ("trip_id", "title_id")
        where "deleted_at" is null;
    `);

    // ── field_receipts ──────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "field_receipts" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "trip_id" uuid not null,
        "title_id" uuid null,
        "method" varchar(12) not null,
        "amount" numeric(14,2) not null,
        "interest" numeric(14,2) not null default 0,
        "inside_wallet" boolean not null default true,
        "status" varchar(12) not null default 'proposto',
        "effectuated_at" timestamptz null,
        constraint "field_receipts_pkey" primary key ("id"),
        constraint "field_receipts_method_check" check ("method" in
          ('dinheiro','pix','cartao','cheque','deposito')),
        constraint "field_receipts_status_check" check ("status" in ('proposto','efetivado')),
        constraint "field_receipts_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "field_receipts_trip_foreign" foreign key ("trip_id") references "trips" ("id") on update cascade on delete cascade,
        constraint "field_receipts_title_foreign" foreign key ("title_id") references "financial_titles" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "field_receipts_account_id_index" on "field_receipts" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "field_receipts_trip_index" on "field_receipts" ("trip_id", "status");`,
    );

    for (const table of ['trip_collections', 'field_receipts']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }
    // Carteira: só select+insert (append). Recebimento: com update (efetivação).
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert on table public.trip_collections to veertex_app;
          grant select, insert, update on table public.field_receipts to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "field_receipts" cascade;`);
    this.addSql(`drop table if exists "trip_collections" cascade;`);
    this.addSql(`alter table "accounts" drop column if exists "rot_recollection_limit";`);
  }
}
