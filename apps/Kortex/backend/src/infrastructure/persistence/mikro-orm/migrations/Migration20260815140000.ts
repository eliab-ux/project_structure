import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 4 — agenda (§4.8) e reserva (§4.9, §4.11).
 *
 * O ponto desta migration é a **constraint de exclusão**: duas horas de máquina não podem se
 * sobrepor na mesma máquina, e isso é garantido pelo BANCO, não só pela aplicação. Entre o
 * `select` que não viu conflito e o `insert` que o cria cabe uma segunda requisição — e duas telas
 * do Administrativo abertas ao mesmo tempo é o cenário normal, não o excepcional.
 *
 * A constraint é **parcial** (`where type = 'machine_hour'`): atendimento pode sobrepor qualquer
 * coisa, e só gera aviso (regra 6.10). São duas regras diferentes e a spec pede explicitamente que
 * não sejam unificadas.
 *
 * Decisões registradas:
 *
 * 1. **`reservation.schedule_entry_id` é UNIQUE** — a spec diz "FK 1:1 com o compromisso
 *    `machine_hour`". Sem o índice único, 1:1 seria só uma intenção escrita no documento.
 *
 * 2. **`total_cents` é coluna, não cálculo em tempo de leitura.** É `hours × hour_price_cents` no
 *    momento da venda, e o CHECK no banco garante que continue sendo — se alguém alterar uma das
 *    três colunas por SQL manual, o banco recusa. Guardar o total é o que faz o relatório de um mês
 *    fechado continuar somando o mesmo valor anos depois.
 *
 * 3. **Sem `waiting_list_entry_id` na reserva.** A ligação com a fila existe pelo `pre_order_id`,
 *    que as duas tabelas carregam. Uma FK a mais seria uma segunda fonte de verdade para a mesma
 *    relação.
 */
export class Migration20260815140000 extends Migration {
  async up(): Promise<void> {
    // ==== schedule_entry (§4.8) ====
    this.addSql(`
      create table "schedule_entry" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        -- Obrigatória em machine_hour, nula em consultation: o CHECK abaixo garante o par.
        "machine_id" uuid null,
        "type" varchar(15) not null,
        "starts_at" timestamptz not null,
        "ends_at" timestamptz not null,
        "customer_id" uuid null,
        "title" varchar(200) null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "schedule_entry_pkey" primary key ("id"),
        constraint "schedule_entry_type_check" check ("type" in ('machine_hour', 'consultation')),
        constraint "schedule_entry_range_check" check ("ends_at" > "starts_at"),
        -- Hora de máquina SEM máquina não existe; e o atendimento é da agenda, não de uma máquina.
        constraint "schedule_entry_machine_required_check"
          check (("type" = 'machine_hour' and "machine_id" is not null)
                 or ("type" = 'consultation' and "machine_id" is null)),
        constraint "schedule_entry_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "schedule_entry_machine_id_foreign" foreign key ("machine_id")
          references "machine" ("id") on update cascade on delete restrict,
        constraint "schedule_entry_customer_id_foreign" foreign key ("customer_id")
          references "customer" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "schedule_entry_account_id_starts_at_index" on "schedule_entry" ("account_id", "starts_at");`,
    );
    this.addSql(`
      create index "schedule_entry_machine_window_index"
        on "schedule_entry" ("machine_id", "starts_at")
        where "type" = 'machine_hour';
    `);

    /**
     * Duas `machine_hour` sobrepostas na mesma máquina: **proibido no banco**.
     *
     * `tstzrange(starts_at, ends_at, '[)')`: fechado no início, aberto no fim. Sem o `'[)'` uma
     * reserva das 7h às 11h e outra das 11h às 15h colidiriam no instante das 11h — que é
     * exatamente como a agenda de uma oficina funciona, uma emendando na outra.
     *
     * Depende de `btree_gist` (criada na baseline) para o operador `=` sobre uuid.
     */
    this.addSql(`
      alter table "schedule_entry" add constraint "schedule_entry_no_machine_overlap"
        exclude using gist (
          "machine_id" with =,
          tstzrange("starts_at", "ends_at", '[)') with &&
        ) where ("type" = 'machine_hour');
    `);

    // ==== reservation (§4.9) ====
    this.addSql(`
      create table "reservation" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "schedule_entry_id" uuid not null,
        "pre_order_id" uuid not null,
        -- Desnormalizados para consulta (§4.9): a fila do Modelista e o relatório do mês não
        -- deveriam precisar de dois joins para saber de quem é o corte e em qual máquina.
        "customer_id" uuid not null,
        "machine_id" uuid not null,

        "hours" int not null,
        -- SNAPSHOT do preço da máquina no dia da venda (decisão 2.9). Mudar o preço da máquina
        -- depois não altera esta linha, e é isso que faz o histórico fechar.
        "hour_price_cents" int not null,
        "total_cents" int not null,
        "status" varchar(15) not null default 'pre_reserved',

        "paid_at" timestamptz null,
        "payment_method" varchar(10) null,
        "paid_registered_by" uuid null,

        "no_show_at" timestamptz null,
        "no_show_resolution" varchar(15) null,

        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),

        constraint "reservation_pkey" primary key ("id"),
        constraint "reservation_hours_check" check ("hours" >= 1),
        constraint "reservation_price_check" check ("hour_price_cents" > 0),
        -- O total é o produto, e o banco cobra isso.
        constraint "reservation_total_check" check ("total_cents" = "hours" * "hour_price_cents"),
        constraint "reservation_status_check"
          check ("status" in ('pre_reserved', 'confirmed', 'in_progress', 'completed',
                              'released', 'no_show', 'cancelled')),
        constraint "reservation_payment_method_check"
          check ("payment_method" is null or "payment_method" in ('pix', 'cash', 'transfer')),
        constraint "reservation_no_show_resolution_check"
          check ("no_show_resolution" is null
                 or "no_show_resolution" in ('rescheduled', 'written_off')),
        -- Pagamento é um ato só: ou os três campos existem, ou nenhum.
        constraint "reservation_payment_together_check"
          check (("paid_at" is null and "payment_method" is null and "paid_registered_by" is null)
                 or ("paid_at" is not null and "payment_method" is not null
                     and "paid_registered_by" is not null)),
        -- 1:1 com o compromisso da agenda (§4.9).
        constraint "reservation_schedule_entry_id_unique" unique ("schedule_entry_id"),
        constraint "reservation_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "reservation_schedule_entry_id_foreign" foreign key ("schedule_entry_id")
          references "schedule_entry" ("id") on update cascade on delete restrict,
        constraint "reservation_pre_order_id_foreign" foreign key ("pre_order_id")
          references "pre_order" ("id") on update cascade on delete restrict,
        constraint "reservation_customer_id_foreign" foreign key ("customer_id")
          references "customer" ("id") on update cascade on delete restrict,
        constraint "reservation_machine_id_foreign" foreign key ("machine_id")
          references "machine" ("id") on update cascade on delete restrict,
        constraint "reservation_paid_registered_by_foreign" foreign key ("paid_registered_by")
          references "app_user" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "reservation_account_id_index" on "reservation" ("account_id");`);
    /**
     * Índice da fila do Modelista: só `confirmed` e `in_progress` (§5).
     *
     * Parcial de propósito — uma reserva `pre_reserved` nunca sai da persistência para ele, e um
     * índice que não a contém é uma barreira a mais no caminho de quem escrever a consulta errada.
     */
    this.addSql(`
      create index "reservation_modelista_queue_index"
        on "reservation" ("account_id", "machine_id")
        where "status" in ('confirmed', 'in_progress');
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "reservation" cascade;');
    this.addSql('drop table if exists "schedule_entry" cascade;');
  }
}
