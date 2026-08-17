import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 3 — pré-pedido (§4.7), fila de espera (§4.12) e o aviso de vaga.
 *
 * Decisões que não estão literalmente na spec:
 *
 * 1. **`slot_notice` não existe no modelo de domínio da spec** — ela aparece só no DoD da Fase 3
 *    ("Modelista consegue avisar o Administrativo de horário vago") e na regra 6.3, que descreve
 *    a sequência: o Modelista **avisa**, o Administrativo escolhe da fila, liga, cobra e registra
 *    pago. A tabela é o mínimo que sustenta esse aviso: quem avisou, quando, o recado, e se já
 *    foi tratado. **Sem `machine_id` e sem horário**: isso seria agendamento, e agendamento é da
 *    Fase 4 e do Administrativo.
 *
 * 2. **`pre_order.created_by_user_id`** — a spec não lista o campo, mas a §4.3 diz que toda
 *    autoria referencia `user_id`, e a regra 6.1 existe justamente para garantir que o pré-pedido
 *    nasceu com o Modelista. Sem o autor, não há como mostrar isso nem depois.
 *
 * 3. **FKs com `on delete restrict`** em tudo: cliente, tecido e tipo de produto não são apagados
 *    (são inativados), e um pré-pedido órfão perderia o histórico que alimenta a estimativa
 *    seguinte.
 */
export class Migration20260815100000 extends Migration {
  async up(): Promise<void> {
    // ==== pre_order (§4.7) ====
    this.addSql(`
      create table "pre_order" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "customer_id" uuid not null,
        "fabric_id" uuid not null,
        "product_type_id" uuid not null,
        "created_by_user_id" uuid not null,

        "estimated_pieces" int not null,
        "meters_per_piece" numeric(8, 3) null,
        "rolls" int null,
        "estimated_layers" int null,
        "estimated_layout_type" varchar(15) null,
        -- Definido pelo Modelista. É o número que o Administrativo recebe pronto e não edita.
        "estimated_hours" int not null,
        "notes" text null,
        "status" varchar(10) not null default 'open',

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "pre_order_pkey" primary key ("id"),
        constraint "pre_order_estimated_hours_check" check ("estimated_hours" >= 1),
        constraint "pre_order_estimated_pieces_check" check ("estimated_pieces" > 0),
        constraint "pre_order_rolls_check" check ("rolls" is null or "rolls" > 0),
        constraint "pre_order_layers_check"
          check ("estimated_layers" is null or "estimated_layers" > 0),
        constraint "pre_order_meters_check"
          check ("meters_per_piece" is null or "meters_per_piece" > 0),
        constraint "pre_order_layout_type_check"
          check ("estimated_layout_type" is null
                 or "estimated_layout_type" in ('sheet_by_sheet', 'zigzag')),
        constraint "pre_order_status_check"
          check ("status" in ('open', 'reserved', 'discarded')),
        constraint "pre_order_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "pre_order_customer_id_foreign" foreign key ("customer_id")
          references "customer" ("id") on update cascade on delete restrict,
        constraint "pre_order_fabric_id_foreign" foreign key ("fabric_id")
          references "fabric" ("id") on update cascade on delete restrict,
        constraint "pre_order_product_type_id_foreign" foreign key ("product_type_id")
          references "product_type" ("id") on update cascade on delete restrict,
        constraint "pre_order_created_by_foreign" foreign key ("created_by_user_id")
          references "app_user" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "pre_order_account_id_index" on "pre_order" ("account_id");`);
    // Caminho quente do painel: "pré-pedidos abertos", mais recentes primeiro.
    this.addSql(`
      create index "pre_order_open_index"
        on "pre_order" ("account_id", "created_at" desc)
        where "status" = 'open';
    `);

    // ==== waiting_list_entry (§4.12) ====
    // Criada e gerida EXCLUSIVAMENTE pelo Administrativo; o Modelista só lê.
    this.addSql(`
      create table "waiting_list_entry" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "customer_id" uuid not null,
        -- Origem: a entrada nasce de um pré-pedido que não achou vaga. Nullable porque o
        -- Administrativo também registra quem ligou pedindo horário sem passar pelo Modelista.
        "pre_order_id" uuid null,
        "fabric_id" uuid null,
        "product_type_id" uuid null,

        "hours_needed" int not null,
        "technical_notes" text null,
        "wants_earlier" boolean not null default false,
        "desired_until" date null,
        "status" varchar(10) not null default 'waiting',
        "offered_at" timestamptz null,
        "customer_accepted_at" timestamptz null,

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "waiting_list_entry_pkey" primary key ("id"),
        constraint "waiting_list_entry_hours_check" check ("hours_needed" >= 1),
        constraint "waiting_list_entry_status_check"
          check ("status" in ('waiting', 'offered', 'converted', 'dropped')),
        constraint "waiting_list_entry_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "waiting_list_entry_customer_id_foreign" foreign key ("customer_id")
          references "customer" ("id") on update cascade on delete restrict,
        constraint "waiting_list_entry_pre_order_id_foreign" foreign key ("pre_order_id")
          references "pre_order" ("id") on update cascade on delete restrict,
        constraint "waiting_list_entry_fabric_id_foreign" foreign key ("fabric_id")
          references "fabric" ("id") on update cascade on delete restrict,
        constraint "waiting_list_entry_product_type_id_foreign" foreign key ("product_type_id")
          references "product_type" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "waiting_list_entry_account_id_index" on "waiting_list_entry" ("account_id");`,
    );
    /**
     * A fila como a tela a mostra: quem **quer antecipar** primeiro, depois por ordem de chegada.
     *
     * `wants_earlier desc` no índice não é capricho de ordenação — é a regra 2.15 e 6.8: o encaixe
     * vem sempre da fila, e quem quer antecipar é justamente quem se chama quando vaga um horário.
     */
    this.addSql(`
      create index "waiting_list_entry_queue_index"
        on "waiting_list_entry" ("account_id", "wants_earlier" desc, "created_at")
        where "status" in ('waiting', 'offered');
    `);

    // ==== slot_notice — o aviso de vaga do Modelista ====
    // Aviso, NÃO agendamento (regra 6.3): sem máquina, sem horário, sem cliente. O Modelista
    // enxerga que vagou e chama o Administrativo; quem escolhe da fila, liga e cobra é ele.
    this.addSql(`
      create table "slot_notice" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "created_by_user_id" uuid not null,
        "note" text not null,
        "status" varchar(10) not null default 'open',
        "handled_by_user_id" uuid null,
        "handled_at" timestamptz null,
        "created_at" timestamptz not null default now(),

        constraint "slot_notice_pkey" primary key ("id"),
        constraint "slot_notice_status_check" check ("status" in ('open', 'handled')),
        constraint "slot_notice_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "slot_notice_created_by_foreign" foreign key ("created_by_user_id")
          references "app_user" ("id") on update cascade on delete restrict,
        constraint "slot_notice_handled_by_foreign" foreign key ("handled_by_user_id")
          references "app_user" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`
      create index "slot_notice_open_index"
        on "slot_notice" ("account_id", "created_at" desc)
        where "status" = 'open';
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "slot_notice" cascade;');
    this.addSql('drop table if exists "waiting_list_entry" cascade;');
    this.addSql('drop table if exists "pre_order" cascade;');
  }
}
