import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 5 — a matriz apontada (§4.10).
 *
 * O que esta tabela mede é **um tempo só**: do manejo do tecido (plotter imprimindo, enfesto
 * começando) até a máquina de corte desligar. Dois toques, `started_at` e `ended_at`.
 *
 * Decisões que valem registro:
 *
 * 1. **`total_pieces` é coluna E tem CHECK.** A spec diz que ele nunca é digitado — é sempre
 *    `layers × nested_pieces`. Guardar o produto faz o relatório de um mês fechado continuar
 *    somando o mesmo número; o CHECK impede que um UPDATE manual quebre a igualdade. Foi
 *    verificado na planilha real do cliente em nove linhas (12 encaixadas × 14 camadas = 168).
 *
 * 2. **`machine_cut_started_at` / `machine_cut_ended_at` nascem e ficam NULOS.** Existem só para
 *    receber o import do relatório do Audaces na fase 7, que é o que vai separar enfesto de corte
 *    no relatório do governo. Decisão do dono: não vale apontar à mão o que a máquina já mede —
 *    por isso **não existe botão de "começou o corte"**.
 *
 * 3. **Os campos do stop andam juntos.** Antes do stop, `ended_at`, `layers`, `nested_pieces`,
 *    `total_pieces` e `layout_type` são todos nulos; depois, todos preenchidos. O CHECK cobra isso
 *    — uma matriz com camadas mas sem fim seria um apontamento pela metade que ninguém sabe ler.
 *
 * 4. **`fabric_id` e `product_type_id` são colunas da matriz**, herdadas do pré-pedido e editáveis
 *    no stop (§4.10). Não são derivados por join: o Modelista pode descobrir na máquina que o
 *    tecido é outro, e o histórico precisa registrar o que foi cortado de verdade.
 */
export class Migration20260815170000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "cut" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "reservation_id" uuid not null,
        "sequence" int not null,
        "marker_name" varchar(120) null,

        -- START: começou a manejar o tecido.
        "started_at" timestamptz not null,
        -- STOP: a máquina de corte desligou. Nulo enquanto a matriz está em andamento.
        "ended_at" timestamptz null,

        -- Reservados para o import do Audaces (fase 7). Ficam NULOS nas fases 1–5.
        "machine_cut_started_at" timestamptz null,
        "machine_cut_ended_at" timestamptz null,

        -- Confirmados no stop.
        "layers" int null,
        "nested_pieces" int null,
        "total_pieces" int null,
        "layout_type" varchar(15) null,

        "fabric_id" uuid not null,
        "product_type_id" uuid not null,

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "cut_pkey" primary key ("id"),
        constraint "cut_sequence_check" check ("sequence" >= 1),
        constraint "cut_range_check" check ("ended_at" is null or "ended_at" > "started_at"),
        constraint "cut_layers_check" check ("layers" is null or "layers" > 0),
        constraint "cut_nested_pieces_check" check ("nested_pieces" is null or "nested_pieces" > 0),
        constraint "cut_layout_type_check"
          check ("layout_type" is null or "layout_type" in ('sheet_by_sheet', 'zigzag')),
        -- total_pieces NUNCA é digitado: é o produto, e o banco confere.
        constraint "cut_total_pieces_check"
          check ("total_pieces" is null or "total_pieces" = "layers" * "nested_pieces"),
        -- Ou a matriz está em andamento (tudo nulo), ou foi encerrada (tudo preenchido).
        constraint "cut_stop_together_check"
          check (
            ("ended_at" is null and "layers" is null and "nested_pieces" is null
             and "total_pieces" is null and "layout_type" is null)
            or
            ("ended_at" is not null and "layers" is not null and "nested_pieces" is not null
             and "total_pieces" is not null and "layout_type" is not null)
          ),
        -- Uma sequência por reserva: 1, 2, 3… A matriz 2 de uma reserva é única.
        constraint "cut_reservation_sequence_unique" unique ("reservation_id", "sequence"),
        constraint "cut_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "cut_reservation_id_foreign" foreign key ("reservation_id")
          references "reservation" ("id") on update cascade on delete restrict,
        constraint "cut_fabric_id_foreign" foreign key ("fabric_id")
          references "fabric" ("id") on update cascade on delete restrict,
        constraint "cut_product_type_id_foreign" foreign key ("product_type_id")
          references "product_type" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "cut_account_id_index" on "cut" ("account_id");`);
    this.addSql(`create index "cut_reservation_id_index" on "cut" ("reservation_id");`);

    /**
     * Índice do histórico por tecido — o DoD exige resposta em menos de 300 ms com 5.000 cortes.
     *
     * Parcial em `ended_at is not null` porque **matriz em andamento não é histórico**: ela não
     * tem duração nem peças ainda. O índice fica com exatamente as linhas que a consulta lê, e
     * `total_pieces` entra como coluna incluída para a agregação não voltar à tabela.
     */
    this.addSql(`
      create index "cut_history_by_fabric_index"
        on "cut" ("account_id", "fabric_id", "total_pieces")
        where "ended_at" is not null;
    `);

    /** Caminho quente do app do Modelista: "a matriz em andamento desta reserva". */
    this.addSql(`
      create index "cut_running_index"
        on "cut" ("reservation_id")
        where "ended_at" is null;
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "cut" cascade;');
  }
}
