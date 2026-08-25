import { Migration } from '@mikro-orm/migrations';

export class Migration20260213190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists "pgcrypto";`);

    this.addSql(`
      create table "users" (
        "id" uuid not null default gen_random_uuid(),
        "email" varchar(255) not null,
        "name" varchar(255) not null,
        "password_hash" varchar(255) not null,
        "role" varchar(20) not null default 'customer',
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "users_pkey" primary key ("id")
      );
    `);
    this.addSql(`alter table "users" add constraint "users_email_unique" unique ("email");`);

    this.addSql(`
      create table "resellers" (
        "id" uuid not null default gen_random_uuid(),
        "user_id" uuid not null,
        "full_name" varchar(255) not null,
        "cpf" varchar(14) not null,
        "phone" varchar(20),
        "reseller_code" varchar(60),
        "unique_link" varchar(60) not null,
        "level" varchar(20) not null default 'bronze',
        "status" varchar(20) not null default 'pending',
        "approved_at" timestamptz,
        "approved_by" uuid,
        "rejected_at" timestamptz,
        "rejected_reason" text,
        "bank_name" varchar(100),
        "bank_code" varchar(10),
        "bank_agency" varchar(20),
        "bank_account" varchar(30),
        "bank_account_type" varchar(20),
        "bank_holder_name" varchar(255),
        "bank_holder_cpf" varchar(14),
        "pix_key" varchar(255),
        "pix_key_type" varchar(20),
        "total_sold_year" numeric(12,2) not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "resellers_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "resellers" add constraint "resellers_user_id_fkey" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "resellers" add constraint "resellers_approved_by_fkey" foreign key ("approved_by") references "users" ("id") on delete set null;`,
    );
    this.addSql(`alter table "resellers" add constraint "resellers_cpf_unique" unique ("cpf");`);
    this.addSql(
      `alter table "resellers" add constraint "resellers_unique_link_unique" unique ("unique_link");`,
    );
    this.addSql(
      `alter table "resellers" add constraint "resellers_reseller_code_unique" unique ("reseller_code");`,
    );
    this.addSql(`create index "idx_resellers_code" on "resellers" ("reseller_code");`);
    this.addSql(`create index "idx_resellers_status" on "resellers" ("status");`);

    this.addSql(`
      create table "subscriptions" (
        "id" uuid not null default gen_random_uuid(),
        "reseller_id" uuid not null,
        "cielo_recurrence_id" varchar(100),
        "status" varchar(20) not null default 'active',
        "amount" numeric(10,2) not null default 9.90,
        "next_billing_date" date,
        "started_at" timestamptz not null default now(),
        "canceled_at" timestamptz,
        "last_payment_at" timestamptz,
        "last_payment_status" varchar(20),
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "subscriptions_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "subscriptions" add constraint "subscriptions_reseller_id_fkey" foreign key ("reseller_id") references "resellers" ("id") on delete cascade;`,
    );
    this.addSql(
      `create unique index "subscriptions_reseller_id_unique" on "subscriptions" ("reseller_id");`,
    );

    this.addSql(`
      create table "products" (
        "id" uuid not null default gen_random_uuid(),
        "bling_id" varchar(50) not null,
        "sku" varchar(100) not null,
        "name" varchar(255) not null,
        "description" text,
        "price" numeric(10,2) not null,
        "cost_price" numeric(10,2),
        "stock" int not null default 0,
        "category_name" varchar(100),
        "weight" numeric(8,3),
        "width" numeric(8,2),
        "height" numeric(8,2),
        "length" numeric(8,2),
        "is_active" boolean not null default true,
        "last_synced_at" timestamptz,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "products_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "products" add constraint "products_bling_id_unique" unique ("bling_id");`,
    );
    this.addSql(`alter table "products" add constraint "products_sku_unique" unique ("sku");`);
    this.addSql(`create index "idx_products_active" on "products" ("is_active");`);

    this.addSql(`
      create table "product_images" (
        "id" uuid not null default gen_random_uuid(),
        "product_id" uuid not null,
        "url" text not null,
        "position" int not null default 0,
        "is_primary" boolean not null default false,
        "created_at" timestamptz not null default now(),
        constraint "product_images_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "product_images" add constraint "product_images_product_id_fkey" foreign key ("product_id") references "products" ("id") on delete cascade;`,
    );
    this.addSql(`create index "idx_product_images_product" on "product_images" ("product_id");`);

    this.addSql(`
      create table "visits" (
        "id" uuid not null default gen_random_uuid(),
        "reseller_code" varchar(60) not null,
        "ip_address" varchar(45),
        "user_agent" text,
        "referer" varchar(500),
        "created_at" timestamptz not null default now(),
        constraint "visits_pkey" primary key ("id")
      );
    `);
    this.addSql(`create index "idx_visits_reseller" on "visits" ("reseller_code");`);
    this.addSql(`create index "idx_visits_created" on "visits" ("created_at");`);

    this.addSql(`
      create table "orders" (
        "id" uuid not null default gen_random_uuid(),
        "order_number" varchar(50) not null,
        "reseller_id" uuid,
        "reseller_code" varchar(60),
        "customer_name" varchar(255) not null,
        "customer_email" varchar(255) not null,
        "customer_cpf" varchar(14) not null,
        "customer_phone" varchar(20),
        "address_zip_code" varchar(9),
        "address_street" varchar(255),
        "address_number" varchar(20),
        "address_complement" varchar(100),
        "address_neighborhood" varchar(100),
        "address_city" varchar(100),
        "address_state" varchar(2),
        "subtotal" numeric(10,2) not null,
        "discount_amount" numeric(10,2) not null default 0,
        "shipping_cost" numeric(10,2) not null default 0,
        "total_amount" numeric(10,2) not null,
        "shipping_carrier" varchar(100),
        "shipping_service" varchar(100),
        "tracking_code" varchar(100),
        "estimated_days" int,
        "payment_method" varchar(20) not null default 'credit_card',
        "installments" int not null default 1,
        "cielo_payment_id" varchar(100),
        "bling_order_id" varchar(50),
        "status" varchar(30) not null default 'pending_payment',
        "coupon_code" varchar(50),
        "paid_at" timestamptz,
        "shipped_at" timestamptz,
        "delivered_at" timestamptz,
        "canceled_at" timestamptz,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "orders_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "orders" add constraint "orders_order_number_unique" unique ("order_number");`,
    );
    this.addSql(`create index "idx_orders_reseller" on "orders" ("reseller_id");`);
    this.addSql(`create index "idx_orders_status" on "orders" ("status");`);
    this.addSql(
      `alter table "orders" add constraint "orders_reseller_id_fkey" foreign key ("reseller_id") references "resellers" ("id");`,
    );

    this.addSql(`
      create table "order_items" (
        "id" uuid not null default gen_random_uuid(),
        "order_id" uuid not null,
        "product_id" uuid not null,
        "product_name" varchar(255) not null,
        "product_sku" varchar(100) not null,
        "quantity" int not null,
        "unit_price" numeric(10,2) not null,
        "total_price" numeric(10,2) not null,
        constraint "order_items_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "order_items" add constraint "order_items_order_id_fkey" foreign key ("order_id") references "orders" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "order_items" add constraint "order_items_product_id_fkey" foreign key ("product_id") references "products" ("id");`,
    );
    this.addSql(`create index "idx_order_items_order" on "order_items" ("order_id");`);

    this.addSql(`
      create table "commissions" (
        "id" uuid not null default gen_random_uuid(),
        "reseller_id" uuid not null,
        "order_id" uuid not null,
        "amount" numeric(10,2) not null,
        "base_amount" numeric(10,2) not null,
        "percentage" numeric(5,2) not null,
        "status" varchar(20) not null default 'pending',
        "available_at" date not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "commissions_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "commissions" add constraint "commissions_reseller_id_fkey" foreign key ("reseller_id") references "resellers" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "commissions" add constraint "commissions_order_id_fkey" foreign key ("order_id") references "orders" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "commissions" add constraint "commissions_order_id_unique" unique ("order_id");`,
    );
    this.addSql(`create index "idx_commissions_reseller" on "commissions" ("reseller_id");`);
    this.addSql(`create index "idx_commissions_status" on "commissions" ("status");`);
    this.addSql(`create index "idx_commissions_available_at" on "commissions" ("available_at");`);

    this.addSql(`
      create table "withdrawals" (
        "id" uuid not null default gen_random_uuid(),
        "reseller_id" uuid not null,
        "amount" numeric(10,2) not null,
        "status" varchar(20) not null default 'requested',
        "bling_payable_id" varchar(50),
        "approved_at" timestamptz,
        "approved_by" uuid,
        "paid_at" timestamptz,
        "rejected_at" timestamptz,
        "rejected_reason" text,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "withdrawals_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "withdrawals" add constraint "withdrawals_reseller_id_fkey" foreign key ("reseller_id") references "resellers" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "withdrawals" add constraint "withdrawals_approved_by_fkey" foreign key ("approved_by") references "users" ("id") on delete set null;`,
    );
    this.addSql(`create index "idx_withdrawals_reseller" on "withdrawals" ("reseller_id");`);
    this.addSql(`create index "idx_withdrawals_status" on "withdrawals" ("status");`);

    this.addSql(`
      create table "withdrawal_commissions" (
        "withdrawal_id" uuid not null,
        "commission_id" uuid not null,
        constraint "withdrawal_commissions_pkey" primary key ("withdrawal_id", "commission_id")
      );
    `);
    this.addSql(
      `alter table "withdrawal_commissions" add constraint "withdrawal_commissions_withdrawal_id_fkey" foreign key ("withdrawal_id") references "withdrawals" ("id") on delete cascade;`,
    );
    this.addSql(
      `alter table "withdrawal_commissions" add constraint "withdrawal_commissions_commission_id_fkey" foreign key ("commission_id") references "commissions" ("id") on delete cascade;`,
    );

    this.addSql(`
      create table "coupons" (
        "id" uuid not null default gen_random_uuid(),
        "code" varchar(50) not null,
        "reseller_id" uuid,
        "discount_type" varchar(20) not null,
        "discount_value" numeric(10,2) not null,
        "valid_from" timestamptz not null default now(),
        "valid_until" timestamptz not null,
        "usage_limit" int,
        "usage_count" int not null default 0,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "coupons_pkey" primary key ("id")
      );
    `);
    this.addSql(`alter table "coupons" add constraint "coupons_code_unique" unique ("code");`);
    this.addSql(
      `alter table "coupons" add constraint "coupons_reseller_id_fkey" foreign key ("reseller_id") references "resellers" ("id") on delete set null;`,
    );
    this.addSql(`create index "idx_coupons_reseller" on "coupons" ("reseller_id");`);

    this.addSql(`
      create table "materials" (
        "id" uuid not null default gen_random_uuid(),
        "title" varchar(255) not null,
        "description" text,
        "type" varchar(20) not null,
        "file_url" text not null,
        "thumbnail_url" text,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "materials_pkey" primary key ("id")
      );
    `);

    this.addSql(`
      create table "bling_tokens" (
        "id" uuid not null default gen_random_uuid(),
        "access_token" text not null,
        "refresh_token" text not null,
        "expires_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "bling_tokens_pkey" primary key ("id")
      );
    `);

    this.addSql(`
      create table "notifications" (
        "id" uuid not null default gen_random_uuid(),
        "user_id" uuid not null,
        "type" varchar(50) not null,
        "title" varchar(255) not null,
        "body" text,
        "read" boolean not null default false,
        "data" jsonb,
        "created_at" timestamptz not null default now(),
        constraint "notifications_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "notifications" add constraint "notifications_user_id_fkey" foreign key ("user_id") references "users" ("id") on delete cascade;`,
    );
    this.addSql(`create index "idx_notifications_user" on "notifications" ("user_id", "read");`);

    this.addSql(`
      create table "system_config" (
        "key" varchar(100) not null,
        "value" text not null,
        "updated_at" timestamptz not null default now(),
        constraint "system_config_pkey" primary key ("key")
      );
    `);
    this.addSql(`
      insert into "system_config" ("key", "value") values
        ('commission_tier_1', '{"minAmount":0,"maxAmount":1000,"percentage":10}'),
        ('commission_tier_2', '{"minAmount":1001,"maxAmount":2000,"percentage":15}'),
        ('commission_tier_3', '{"minAmount":2001,"maxAmount":5000,"percentage":20}'),
        ('commission_tier_4', '{"minAmount":5001,"maxAmount":null,"percentage":30}'),
        ('commission_grace_days', '30'),
        ('withdrawal_minimum_amount', '50.00'),
        ('subscription_price', '9.90'),
        ('subscription_grace_days', '7');
    `);

    this.addSql(`
      create table "email_logs" (
        "id" uuid not null default gen_random_uuid(),
        "to_email" varchar(255) not null,
        "template" varchar(100) not null,
        "subject" varchar(255) not null,
        "status" varchar(20) not null default 'sent',
        "error" text,
        "sent_at" timestamptz not null default now(),
        constraint "email_logs_pkey" primary key ("id")
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_logs" cascade;`);
    this.addSql(`drop table if exists "notifications" cascade;`);
    this.addSql(`drop table if exists "system_config" cascade;`);
    this.addSql(`drop table if exists "bling_tokens" cascade;`);
    this.addSql(`drop table if exists "materials" cascade;`);
    this.addSql(`drop table if exists "withdrawal_commissions" cascade;`);
    this.addSql(`drop table if exists "withdrawals" cascade;`);
    this.addSql(`drop table if exists "commissions" cascade;`);
    this.addSql(`drop table if exists "order_items" cascade;`);
    this.addSql(`drop table if exists "orders" cascade;`);
    this.addSql(`drop table if exists "visits" cascade;`);
    this.addSql(`drop table if exists "product_images" cascade;`);
    this.addSql(`drop table if exists "products" cascade;`);
    this.addSql(`drop table if exists "subscriptions" cascade;`);
    this.addSql(`drop table if exists "coupons" cascade;`);
    this.addSql(`drop table if exists "resellers" cascade;`);
    this.addSql(`drop table if exists "users" cascade;`);
  }
}
