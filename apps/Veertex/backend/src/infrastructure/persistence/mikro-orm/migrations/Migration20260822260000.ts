import { Migration } from '@mikro-orm/migrations';

/**
 * FIN fatia 2 (§05) — `financial_titles` (a receber/pagar, com direção) + `title_settlements`
 * (baixas, append-only) + parâmetros de juros/multa por conta. Tenant + RLS (cobertas pelo
 * `verify:isolation`). O título aceita update (status/header); a baixa é **append-only** (grant SÓ
 * select+insert). A filha carrega `account_id` e tem policy PRÓPRIA (RLS não segue JOIN).
 */
export class Migration20260822260000 extends Migration {
  async up(): Promise<void> {
    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;

    this.addSql(`
      alter table "accounts"
        add column if not exists "fin_monthly_interest_percent" numeric(6,2) not null default 0,
        add column if not exists "fin_fine_percent" numeric(6,2) not null default 0;
    `);

    // ── financial_titles ────────────────────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "financial_titles" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "direction" varchar(12) not null,
        "company_id" uuid not null,
        "contact_id" uuid null,
        "category_id" uuid null,
        "description" varchar(200) not null,
        "amount" numeric(14,2) not null,
        "issue_date" timestamptz not null,
        "due_date" timestamptz not null,
        "origin" varchar(16) not null,
        "status" varchar(20) not null default 'open',
        constraint "financial_titles_pkey" primary key ("id"),
        constraint "financial_titles_direction_check" check ("direction" in ('receivable','payable')),
        constraint "financial_titles_status_check" check ("status" in
          ('open','partial','settled','renegotiated','written_off_pending','written_off')),
        constraint "financial_titles_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "financial_titles_company_id_foreign" foreign key ("company_id") references "companies" ("id") on update cascade on delete restrict,
        constraint "financial_titles_contact_id_foreign" foreign key ("contact_id") references "contacts" ("id") on update cascade on delete set null,
        constraint "financial_titles_category_id_foreign" foreign key ("category_id") references "financial_categories" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "financial_titles_account_id_index" on "financial_titles" ("account_id");`,
    );
    this.addSql(`
      create index if not exists "financial_titles_scope_index"
        on "financial_titles" ("direction", "company_id", "status", "due_date");
    `);

    // ── title_settlements (append-only) ─────────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "title_settlements" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "title_id" uuid not null,
        "financial_account_id" uuid not null,
        "method" varchar(16) not null,
        "principal" numeric(14,2) not null,
        "interest" numeric(14,2) not null default 0,
        "fine" numeric(14,2) not null default 0,
        "discount" numeric(14,2) not null default 0,
        "settled_at" timestamptz not null,
        constraint "title_settlements_pkey" primary key ("id"),
        constraint "title_settlements_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "title_settlements_title_foreign" foreign key ("title_id") references "financial_titles" ("id") on update cascade on delete cascade,
        constraint "title_settlements_account_foreign" foreign key ("financial_account_id") references "financial_accounts" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index if not exists "title_settlements_account_id_index" on "title_settlements" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "title_settlements_title_index" on "title_settlements" ("title_id");`,
    );

    // ── RLS + grants ────────────────────────────────────────────────────────────────────────────
    for (const table of ['financial_titles', 'title_settlements']) {
      this.addSql(`alter table "${table}" enable row level security;`);
      this.addSql(`drop policy if exists "${table}_tenant_isolation" on "${table}";`);
      this.addSql(`
        create policy "${table}_tenant_isolation" on "${table}"
          for all
          using ("account_id" = ${tenantScope})
          with check ("account_id" = ${tenantScope});
      `);
    }
    // Título: select+insert+update (status/header). Baixa: SÓ select+insert (append-only).
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.financial_titles to veertex_app;
          grant select, insert on table public.title_settlements to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "title_settlements" cascade;`);
    this.addSql(`drop table if exists "financial_titles" cascade;`);
    this.addSql(`alter table "accounts" drop column if exists "fin_fine_percent";`);
    this.addSql(`alter table "accounts" drop column if exists "fin_monthly_interest_percent";`);
  }
}
