import { Migration } from '@mikro-orm/migrations';

/**
 * ROT fatia 6 (§04, evidências + promissória) — `order_evidences` (GPS/fotos, **append-only**: GPS
 * imutável; alteração é linha nova apontando a anterior, auditada) e `promissory_notes` (1 por
 * pedido, valor por extenso, snapshot da devedora). Tenant + RLS. Evidência: grant SÓ select+insert
 * (a imutabilidade do GPS é garantia do BANCO, não convenção). Promissória: idem (2ª via = reler).
 */
export class Migration20260823160000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      create table if not exists "order_evidences" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "order_id" uuid not null,
        "trip_id" uuid null,
        "type" varchar(20) not null,
        "latitude" numeric(10,7) null,
        "longitude" numeric(10,7) null,
        "object_key" varchar(300) null,
        "previous_evidence_id" uuid null,
        "changed_by_user_id" uuid null,
        "change_reason" text null,
        "captured_at" timestamptz not null,
        constraint "order_evidences_pkey" primary key ("id"),
        constraint "order_evidences_type_check" check ("type" in
          ('gps','foto_comprovante','foto_promissoria')),
        constraint "order_evidences_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "order_evidences_order_foreign" foreign key ("order_id") references "orders" ("id") on update cascade on delete cascade,
        constraint "order_evidences_trip_foreign" foreign key ("trip_id") references "trips" ("id") on update cascade on delete set null,
        constraint "order_evidences_previous_foreign" foreign key ("previous_evidence_id") references "order_evidences" ("id") on update cascade on delete set null,
        constraint "order_evidences_changed_by_foreign" foreign key ("changed_by_user_id") references "users" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "order_evidences_account_id_index" on "order_evidences" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "order_evidences_order_index" on "order_evidences" ("order_id", "type");`,
    );

    this.addSql(`
      create table if not exists "promissory_notes" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "order_id" uuid not null,
        "amount" numeric(14,2) not null,
        "amount_in_words" text not null,
        "debtor_name" varchar(200) not null,
        "debtor_document" varchar(14) null,
        "debtor_address" text null,
        "due_date" timestamptz not null,
        constraint "promissory_notes_pkey" primary key ("id"),
        constraint "promissory_notes_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "promissory_notes_order_foreign" foreign key ("order_id") references "orders" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "promissory_notes_account_id_index" on "promissory_notes" ("account_id");`,
    );
    // 1 promissória por pedido — a 2ª via reimprime a existente, nunca gera outra.
    this.addSql(`
      create unique index if not exists "promissory_notes_order_unique"
        on "promissory_notes" ("order_id")
        where "deleted_at" is null;
    `);

    for (const table of ['order_evidences', 'promissory_notes']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
      // Append-only: SÓ select+insert — imutabilidade como garantia do banco.
      this.addSql(`
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'veertex_app') then
            grant select, insert on table public.${table} to veertex_app;
          end if;
        end
        $$;
      `);
    }
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "promissory_notes" cascade;`);
    this.addSql(`drop table if exists "order_evidences" cascade;`);
  }
}
