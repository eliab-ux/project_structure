import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 2 — cadastros: `customer` (§4.4), `fabric` (§4.5) e `product_type` (§4.6).
 *
 * Decisões que não estão literalmente na spec:
 *
 * 1. **`document` guarda só dígitos.** Máscara é apresentação. Guardar `11.222.333/0001-81` faria
 *    o índice único de `(account_id, document)` deixar passar o mesmo CNPJ digitado sem pontuação
 *    — o duplicado entraria pela porta da frente, que é exatamente o que o índice existe para
 *    impedir.
 *
 * 2. **`UNIQUE (account_id, name)` em `fabric` e `product_type`.** Não está na spec e está aqui
 *    porque a §4.5 diz que a altura máxima do tecido é "o coração da estimativa": dois cadastros
 *    "Malha" com alturas diferentes tornam a estimativa ambígua justamente onde ela precisa ser
 *    exata. Se você preferir permitir homônimos, é um `drop constraint`.
 *
 * 3. **`max_layer_height_cm` é `numeric(5,2)`**, não float: 999,99 cm de teto com duas casas
 *    exatas. Float aproximaria 2,5 e a comparação com as camadas informadas erraria na borda.
 *
 * 4. Os enums viram `varchar` + CHECK pelo mesmo motivo da Fase 1: acrescentar valor a um enum
 *    nativo do Postgres é DDL.
 */
export class Migration20260814150000 extends Migration {
  async up(): Promise<void> {
    // ==== customer (§4.4) ====
    this.addSql(`
      create table "customer" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,

        "legal_name" varchar(200) not null,
        "trade_name" varchar(200) not null,
        "document_type" varchar(4) not null,
        "document" varchar(14) not null,
        "state_registration" varchar(30) null,
        "company_size" varchar(10) null,
        "employees_count" int null,
        "status" varchar(10) not null default 'active',

        "zip_code" varchar(8) null,
        "street" varchar(200) null,
        "number" varchar(20) null,
        "complement" varchar(100) null,
        "district" varchar(100) null,
        "city" varchar(120) not null,
        "state" char(2) not null,

        "rep_name" varchar(200) not null,
        "rep_role" varchar(10) null,
        "rep_cpf" varchar(11) not null,
        "rep_phone" varchar(20) not null,
        "rep_email" varchar(255) not null,

        "whatsapp" varchar(20) not null,
        "email" varchar(255) null,
        "phone" varchar(20) null,

        "is_member" boolean not null default false,
        "member_since" date null,
        "notes" text null,

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "customer_pkey" primary key ("id"),
        constraint "customer_document_type_check" check ("document_type" in ('cnpj', 'cpf')),
        constraint "customer_company_size_check"
          check ("company_size" is null or "company_size" in ('mei', 'me', 'epp', 'other')),
        constraint "customer_status_check" check ("status" in ('active', 'inactive')),
        constraint "customer_rep_role_check"
          check ("rep_role" is null or "rep_role" in ('president', 'partner', 'owner', 'other')),
        constraint "customer_employees_count_check"
          check ("employees_count" is null or "employees_count" >= 0),
        -- Único POR CONTA, não global: duas contas diferentes podem atender o mesmo cliente
        -- (spec §4.4).
        constraint "customer_account_id_document_unique" unique ("account_id", "document"),
        constraint "customer_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "customer_account_id_index" on "customer" ("account_id");`);
    // Caminho quente da tela de clientes: buscar por nome fantasia dentro da conta.
    this.addSql(
      `create index "customer_account_id_trade_name_index" on "customer" ("account_id", "trade_name");`,
    );

    // ==== fabric (§4.5) ====
    this.addSql(`
      create table "fabric" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(120) not null,
        "max_layer_height_cm" numeric(5, 2) not null,
        "notes" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "fabric_pkey" primary key ("id"),
        constraint "fabric_max_layer_height_positive" check ("max_layer_height_cm" > 0),
        constraint "fabric_account_id_name_unique" unique ("account_id", "name"),
        constraint "fabric_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "fabric_account_id_index" on "fabric" ("account_id");`);

    // ==== product_type (§4.6) ====
    this.addSql(`
      create table "product_type" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(120) not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "product_type_pkey" primary key ("id"),
        constraint "product_type_account_id_name_unique" unique ("account_id", "name"),
        constraint "product_type_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "product_type_account_id_index" on "product_type" ("account_id");`);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "product_type" cascade;');
    this.addSql('drop table if exists "fabric" cascade;');
    this.addSql('drop table if exists "customer" cascade;');
  }
}
