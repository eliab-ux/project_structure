import { Migration } from '@mikro-orm/migrations';

/**
 * VND — `order_payments` (§4.1 do 02A): pagamentos do pedido, N por pedido (misto), com o bloco
 * TEF-ready. Tabela de TENANT com RLS (coberta pelo `verify:isolation`). **Dormente** — o schema
 * nasce pronto (a IN 1608/25-GO exige o vínculo pagamento↔NFC-e), mas nenhum fluxo grava até o
 * PDV/TEF existir. Grant COM update (o fechamento futuro corrige status TEF), SEM delete.
 *
 * Também adiciona `orders.payment_rounding` (acréscimo/desconto em reais no fechamento — espécie),
 * igualmente dormente, default 0.
 */
export class Migration20260822210000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "orders"
        add column if not exists "payment_rounding" numeric(14,2) not null default 0;
    `);

    this.addSql(`
      create table if not exists "order_payments" (
        "id" uuid not null,
        "account_id" uuid not null,
        "created_at" timestamptz not null,
        "updated_at" timestamptz not null,
        "deleted_at" timestamptz null,
        "order_id" uuid not null,
        "method" varchar(20) not null,
        "payment_condition_id" uuid null,
        "amount" numeric(14,2) not null,
        "installments" int not null default 1,
        "tef_provider" varchar(60) null,
        "tef_nsu" varchar(60) null,
        "tef_authorization" varchar(60) null,
        "tef_brand" varchar(40) null,
        "tef_status" varchar(40) null,
        "tef_payload" text null,
        "acquirer_cnpj" varchar(14) null,
        constraint "order_payments_pkey" primary key ("id"),
        constraint "order_payments_method_check" check ("method" in
          ('dinheiro','cartao_credito','cartao_debito','pix','boleto','cheque','promissoria','outro')),
        constraint "order_payments_account_id_foreign" foreign key ("account_id") references "accounts" ("id") on update cascade,
        constraint "order_payments_order_id_foreign" foreign key ("order_id") references "orders" ("id") on update cascade on delete restrict,
        constraint "order_payments_condition_foreign" foreign key ("payment_condition_id") references "payment_conditions" ("id") on update cascade on delete set null
      );
    `);
    this.addSql(
      `create index if not exists "order_payments_account_id_index" on "order_payments" ("account_id");`,
    );
    this.addSql(
      `create index if not exists "order_payments_order_id_index" on "order_payments" ("order_id");`,
    );

    const tenantScope = `nullif(current_setting('app.account_id', true), '')::uuid`;
    this.addSql(`alter table "order_payments" enable row level security;`);
    this.addSql(`drop policy if exists "order_payments_tenant_isolation" on "order_payments";`);
    this.addSql(`
      create policy "order_payments_tenant_isolation" on "order_payments"
        for all
        using ("account_id" = ${tenantScope})
        with check ("account_id" = ${tenantScope});
    `);
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_roles where rolname = 'veertex_app') then
          grant select, insert, update on table public.order_payments to veertex_app;
        end if;
      end
      $$;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "order_payments" cascade;`);
    this.addSql(`alter table "orders" drop column if exists "payment_rounding";`);
  }
}
