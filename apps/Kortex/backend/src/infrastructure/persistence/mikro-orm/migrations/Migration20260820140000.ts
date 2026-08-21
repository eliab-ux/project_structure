import { Migration } from '@mikro-orm/migrations';

/**
 * O pedido passa a **declarar as matrizes**, e cada uma é apontada uma vez.
 *
 * Antes: o pedido tinha UM tecido e UM produto, e o Modelista abria quantos `cut` quisesse
 * dentro da reserva, numerados por `sequence`. Não era o que a operação faz — o cliente chega
 * com materiais diferentes na mesma reserva (matriz 1: tecido X, calça; matriz 2: tecido Y,
 * camiseta), e isso precisa estar no pedido, não improvisado no chão de fábrica.
 *
 * Depois: `pre_order` 1:N `pre_order_item` 1:1 `cut`. Apontar matriz que ninguém declarou deixa
 * de ser possível, e a contagem de matrizes do apontamento passa a ser a do pedido.
 *
 * ## Migração dos dados existentes
 *
 * Cada pedido vira um item (sequence 1) com o tecido e o produto que ele já tinha, e cada corte
 * é ligado ao item do seu pedido. **Nenhum dado é descartado**, e é por isso que a migration
 * copia antes de apagar as colunas.
 *
 * O caso que não tem tradução: pedido com DOIS cortes no modelo antigo. Ambos apontavam a mesma
 * matriz implícita, e agora só um pode ficar ligado ao item — o segundo ganha um item próprio,
 * criado a partir do que o próprio corte registrou. Assim nada some, mas o pedido passa a
 * declarar duas matrizes retroativamente, que é o que ele de fato executou.
 */
export class Migration20260820140000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "pre_order_item" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "pre_order_id" uuid not null,
        "sequence" int not null,
        "fabric_id" uuid not null,
        "product_type_id" uuid not null,
        "estimated_pieces" int not null,
        "meters_per_piece" numeric(8,3) null,
        "rolls" int null,
        "estimated_layers" int null,
        "estimated_layout_type" varchar(20) null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "pre_order_item_pkey" primary key ("id")
      );
    `);

    this.addSql(`
      alter table "pre_order_item"
        add constraint "pre_order_item_account_fk" foreign key ("account_id")
          references "account" ("id") on update cascade,
        add constraint "pre_order_item_pre_order_fk" foreign key ("pre_order_id")
          references "pre_order" ("id") on update cascade on delete cascade,
        add constraint "pre_order_item_fabric_fk" foreign key ("fabric_id")
          references "fabric" ("id") on update cascade,
        add constraint "pre_order_item_product_type_fk" foreign key ("product_type_id")
          references "product_type" ("id") on update cascade;
    `);

    this.addSql(
      `create index "pre_order_item_account_id_index" on "pre_order_item" ("account_id");`,
    );
    this.addSql(`
      create index "pre_order_item_pre_order_id_index" on "pre_order_item" ("pre_order_id");
    `);
    // A ordem das matrizes dentro do pedido é única: duas "matriz 2" no mesmo pedido tornariam
    // a tela e o relatório ambíguos.
    this.addSql(`
      alter table "pre_order_item"
        add constraint "pre_order_item_sequence_unique" unique ("pre_order_id", "sequence");
    `);
    this.addSql(`
      alter table "pre_order_item"
        add constraint "pre_order_item_estimated_pieces_check" check ("estimated_pieces" > 0);
    `);

    // ---- Dados: cada pedido existente vira a sua matriz 1 ----
    this.addSql(`
      insert into "pre_order_item" (
        "account_id", "pre_order_id", "sequence", "fabric_id", "product_type_id",
        "estimated_pieces", "meters_per_piece", "rolls", "estimated_layers",
        "estimated_layout_type", "created_at", "updated_at"
      )
      select
        p."account_id", p."id", 1, p."fabric_id", p."product_type_id",
        greatest(p."estimated_pieces", 1), p."meters_per_piece", p."rolls", p."estimated_layers",
        p."estimated_layout_type", p."created_at", p."updated_at"
      from "pre_order" p;
    `);

    this.addSql(`alter table "cut" add column "pre_order_item_id" uuid null;`);

    // O primeiro corte de cada reserva assume a matriz 1 do pedido dela.
    this.addSql(`
      with primeiro as (
        select distinct on (c."reservation_id") c."id" as cut_id, i."id" as item_id
        from "cut" c
        join "reservation" r on r."id" = c."reservation_id"
        join "pre_order_item" i on i."pre_order_id" = r."pre_order_id" and i."sequence" = 1
        order by c."reservation_id", c."started_at"
      )
      update "cut" c set "pre_order_item_id" = primeiro.item_id
      from primeiro where primeiro.cut_id = c."id";
    `);

    /**
     * Os cortes restantes ganham um item próprio, montado com o que eles mesmos registraram.
     *
     * A numeração é `1 + row_number()` sobre a MESMA ordenação usada logo abaixo para ligar cada
     * corte ao seu item — inclusive o desempate por `id`. É o que garante o pareamento um-a-um:
     * casar por tecido e produto pareceria mais natural, mas dois cortes do mesmo pedido no mesmo
     * material apontariam para o mesmo item, e o índice único derrubaria a migration no meio.
     */
    this.addSql(`
      insert into "pre_order_item" (
        "account_id", "pre_order_id", "sequence", "fabric_id", "product_type_id",
        "estimated_pieces", "estimated_layers", "estimated_layout_type", "created_at", "updated_at"
      )
      select
        c."account_id", r."pre_order_id",
        1 + row_number() over (
          partition by r."pre_order_id" order by c."started_at", c."id"
        ),
        c."fabric_id", c."product_type_id",
        greatest(coalesce(c."total_pieces", 1), 1), c."layers", c."layout_type",
        c."created_at", c."updated_at"
      from "cut" c
      join "reservation" r on r."id" = c."reservation_id"
      where c."pre_order_item_id" is null;
    `);

    this.addSql(`
      with pendente as (
        select
          c."id" as cut_id,
          r."pre_order_id" as pre_order_id,
          1 + row_number() over (
            partition by r."pre_order_id" order by c."started_at", c."id"
          ) as seq
        from "cut" c
        join "reservation" r on r."id" = c."reservation_id"
        where c."pre_order_item_id" is null
      )
      update "cut" c set "pre_order_item_id" = i."id"
      from pendente p
      join "pre_order_item" i
        on i."pre_order_id" = p.pre_order_id and i."sequence" = p.seq
      where p.cut_id = c."id";
    `);

    /**
     * Agora a coluna vira obrigatória — e **não** há `delete` de corte sem item.
     *
     * Se sobrasse algum, o certo é a migration abortar aqui e alguém olhar: apagar apontamento em
     * silêncio para uma migration passar é perder tempo de máquina já cobrado do cliente.
     */
    this.addSql(`alter table "cut" alter column "pre_order_item_id" set not null;`);
    this.addSql(`
      alter table "cut"
        add constraint "cut_pre_order_item_fk" foreign key ("pre_order_item_id")
          references "pre_order_item" ("id") on update cascade;
    `);
    // **Um apontamento por matriz declarada** — a garantia fica no banco, não só na aplicação.
    this.addSql(`
      alter table "cut"
        add constraint "cut_one_per_pre_order_item" unique ("pre_order_item_id");
    `);
    this.addSql(`alter table "cut" drop column "sequence";`);

    // O pedido deixa de carregar tecido, produto e quantidades: agora é da matriz.
    this.addSql(`
      alter table "pre_order"
        drop column "fabric_id",
        drop column "product_type_id",
        drop column "estimated_pieces",
        drop column "meters_per_piece",
        drop column "rolls",
        drop column "estimated_layers",
        drop column "estimated_layout_type";
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      alter table "pre_order"
        add column "fabric_id" uuid null,
        add column "product_type_id" uuid null,
        add column "estimated_pieces" int null,
        add column "meters_per_piece" numeric(8,3) null,
        add column "rolls" int null,
        add column "estimated_layers" int null,
        add column "estimated_layout_type" varchar(20) null;
    `);
    this.addSql(`
      update "pre_order" p set
        "fabric_id" = i."fabric_id",
        "product_type_id" = i."product_type_id",
        "estimated_pieces" = i."estimated_pieces",
        "meters_per_piece" = i."meters_per_piece",
        "rolls" = i."rolls",
        "estimated_layers" = i."estimated_layers",
        "estimated_layout_type" = i."estimated_layout_type"
      from "pre_order_item" i
      where i."pre_order_id" = p."id" and i."sequence" = 1;
    `);
    this.addSql(`alter table "cut" add column "sequence" int not null default 1;`);
    this.addSql(`alter table "cut" drop constraint if exists "cut_one_per_pre_order_item";`);
    this.addSql(`alter table "cut" drop constraint if exists "cut_pre_order_item_fk";`);
    this.addSql(`alter table "cut" drop column if exists "pre_order_item_id";`);
    this.addSql(`drop table if exists "pre_order_item";`);
  }
}
