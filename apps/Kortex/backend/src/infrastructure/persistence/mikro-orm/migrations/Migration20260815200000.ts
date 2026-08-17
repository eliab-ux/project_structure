import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 6 — financeiro de caixa: `bank_account` (§4.13), `financial_category` (§4.14) e
 * `cash_entry` (§4.15).
 *
 * **Não existe tabela de DRE** (§4.16): o DRE é uma consulta sobre `cash_entry`. Uma tabela de
 * resultado precisaria ser recalculada a cada cancelamento, e a primeira vez que alguém
 * esquecesse de recalcular o relatório passaria a mentir.
 *
 * **Isto não é folha de pagamento** (§4.15). Salário e contrato de prestador são apenas saídas com
 * categoria e `payee`. Não há — e não pode haver — coluna de encargo, INSS, FGTS, holerite,
 * competência trabalhista ou rescisão. O cálculo continua na contabilidade.
 *
 * Os CHECKs abaixo carregam as invariantes que a spec chama de não-flexibilizáveis:
 *
 * 1. `in`/`out` exigem categoria; `transfer` **não tem** categoria e **exige** a conta destino.
 * 2. A conta destino de uma transferência é diferente da origem — transferir para si mesma seria
 *    um lançamento que não move nada e ainda aparece no extrato duas vezes.
 * 3. Cancelamento é um bloco: ou os três campos existem (data, motivo, autor), ou nenhum.
 *    Cancelado sem motivo é exatamente o registro que ninguém consegue auditar depois.
 */
export class Migration20260815200000 extends Migration {
  async up(): Promise<void> {
    // ==== bank_account (§4.13) ====
    this.addSql(`
      create table "bank_account" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(120) not null,
        "bank" varchar(120) null,
        -- Saldo, não preço: pode ser zero. O default da spec é 0.
        "opening_balance_cents" int not null default 0,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "bank_account_pkey" primary key ("id"),
        constraint "bank_account_account_id_name_unique" unique ("account_id", "name"),
        constraint "bank_account_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "bank_account_account_id_index" on "bank_account" ("account_id");`);

    // ==== financial_category (§4.14) ====
    this.addSql(`
      create table "financial_category" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(120) not null,
        "direction" varchar(3) not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "financial_category_pkey" primary key ("id"),
        constraint "financial_category_direction_check" check ("direction" in ('in', 'out')),
        -- Único por conta E direção: "Manutenção" pode existir como saída sem impedir uma
        -- eventual "Manutenção" de entrada (reembolso), que é outra coisa.
        constraint "financial_category_unique" unique ("account_id", "direction", "name"),
        constraint "financial_category_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "financial_category_account_id_index" on "financial_category" ("account_id");`,
    );

    // ==== cash_entry (§4.15) ====
    this.addSql(`
      create table "cash_entry" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "type" varchar(10) not null,
        -- REGIME DE CAIXA: o lançamento conta no mês em que o dinheiro entrou ou saiu.
        -- Reserva de outubro paga em agosto entra no caixa de agosto. Não há competência.
        "occurred_on" date not null,
        "amount_cents" int not null,
        "category_id" uuid null,
        "bank_account_id" uuid not null,
        "counterpart_account_id" uuid null,
        "description" varchar(300) not null,
        "payee" varchar(200) null,
        "payment_method" varchar(10) null,
        -- Preenchido quando a entrada nasceu de uma reserva. É por ele que a não-duplicação é
        -- verificável: uma reserva tem no máximo uma entrada de caixa.
        "reservation_id" uuid null,
        "created_by" uuid not null,

        "cancelled_at" timestamptz null,
        "cancelled_reason" varchar(300) null,
        "cancelled_by" uuid null,

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "cash_entry_pkey" primary key ("id"),
        constraint "cash_entry_type_check" check ("type" in ('in', 'out', 'transfer')),
        constraint "cash_entry_amount_check" check ("amount_cents" > 0),
        constraint "cash_entry_payment_method_check"
          check ("payment_method" is null or "payment_method" in ('pix', 'cash', 'transfer')),
        -- in/out têm categoria e não têm contrapartida; transfer é o oposto exato.
        constraint "cash_entry_shape_check"
          check (
            ("type" in ('in', 'out')
              and "category_id" is not null and "counterpart_account_id" is null)
            or
            ("type" = 'transfer'
              and "category_id" is null and "counterpart_account_id" is not null)
          ),
        constraint "cash_entry_transfer_accounts_check"
          check ("counterpart_account_id" is null
                 or "counterpart_account_id" <> "bank_account_id"),
        -- Cancelamento é um bloco: data, motivo e autor andam juntos.
        constraint "cash_entry_cancel_together_check"
          check (
            ("cancelled_at" is null and "cancelled_reason" is null and "cancelled_by" is null)
            or
            ("cancelled_at" is not null and "cancelled_reason" is not null
             and "cancelled_by" is not null)
          ),
        constraint "cash_entry_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "cash_entry_category_id_foreign" foreign key ("category_id")
          references "financial_category" ("id") on update cascade on delete restrict,
        constraint "cash_entry_bank_account_id_foreign" foreign key ("bank_account_id")
          references "bank_account" ("id") on update cascade on delete restrict,
        constraint "cash_entry_counterpart_account_id_foreign" foreign key ("counterpart_account_id")
          references "bank_account" ("id") on update cascade on delete restrict,
        constraint "cash_entry_reservation_id_foreign" foreign key ("reservation_id")
          references "reservation" ("id") on update cascade on delete restrict,
        constraint "cash_entry_created_by_foreign" foreign key ("created_by")
          references "app_user" ("id") on update cascade on delete restrict,
        constraint "cash_entry_cancelled_by_foreign" foreign key ("cancelled_by")
          references "app_user" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "cash_entry_account_id_index" on "cash_entry" ("account_id");`);

    /**
     * **Uma reserva, no máximo uma entrada de caixa.**
     *
     * Índice único PARCIAL: vale só para lançamentos vivos (`cancelled_at is null`), porque um
     * lançamento cancelado por engano precisa poder ser refeito. É esta linha que torna a
     * não-duplicação impossível, e não apenas improvável — registrar o pagamento duas vezes
     * esbarra no banco, não numa checagem que alguém pode remover.
     */
    this.addSql(`
      create unique index "cash_entry_one_per_reservation"
        on "cash_entry" ("reservation_id")
        where "reservation_id" is not null and "cancelled_at" is null;
    `);

    /** Caminho quente do DRE e do extrato: período + conta, só lançamentos vivos. */
    this.addSql(`
      create index "cash_entry_period_index"
        on "cash_entry" ("account_id", "occurred_on", "type")
        where "cancelled_at" is null;
    `);
    this.addSql(`
      create index "cash_entry_bank_account_index"
        on "cash_entry" ("bank_account_id", "occurred_on")
        where "cancelled_at" is null;
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "cash_entry" cascade;');
    this.addSql('drop table if exists "financial_category" cascade;');
    this.addSql('drop table if exists "bank_account" cascade;');
  }
}
