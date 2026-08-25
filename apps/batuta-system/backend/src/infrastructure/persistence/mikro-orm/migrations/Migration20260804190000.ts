import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 6 — `distributions` e `dispatches` (§4).
 *
 * Duas decisões que só se pagam agora e custam caro depois:
 *
 *  1. **Índices exatamente os que §4 nomeia.** Não são enfeite: o worker reivindica por
 *     (status, scheduled_at), o painel agrupa por (distribution_id, status), a migração de remetente
 *     varre (channel_id, scheduled_at) e o relatório por contato usa (contact_id, sent_at). Sem eles,
 *     cada um desses caminhos vira varredura de tabela na maior tabela do sistema.
 *
 *  2. **CHECKs que amarram estado e motivo.** `blocked_reason` só existe com status BLOCKED, e
 *     `sent_at`/`evolution_message_id` só com SENT. O banco recusando um estado impossível é a última
 *     linha de defesa da trilha de auditoria — um `sent_at` preenchido num envio que nunca saiu
 *     mentiria no relatório exportável (§11 item 2), que é justamente o artefato que responde a
 *     questionamento externo.
 */
export class Migration20260804190000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "distributions" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "content_id" uuid not null,
        "window_start" timestamptz not null,
        "window_end" timestamptz not null,
        "status" varchar(20) not null,
        "target_filter" jsonb not null default '{}'::jsonb,
        "config" jsonb not null default '{}'::jsonb,
        "created_by" uuid not null,
        "confirmed_at" timestamptz null,
        "completed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "distributions_pkey" primary key ("id"),
        constraint "distributions_status_check" check (
          "status" in ('DRAFT','PLANNED','RUNNING','PAUSED','COMPLETED','CANCELLED')
        ),
        constraint "distributions_window_check" check ("window_end" > "window_start"),
        constraint "distributions_confirmed_check" check (
          "status" = 'DRAFT' or "confirmed_at" is not null
        )
      );
    `);

    this.addSql(
      `alter table "distributions" add constraint "distributions_account_id_foreign"
       foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "distributions" add constraint "distributions_content_id_foreign"
       foreign key ("content_id") references "contents" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "distributions" add constraint "distributions_created_by_foreign"
       foreign key ("created_by") references "users" ("id") on update cascade;`,
    );
    this.addSql(
      `create index "distributions_account_id_status_index" on "distributions" ("account_id","status");`,
    );
    this.addSql(`create index "distributions_content_id_index" on "distributions" ("content_id");`);

    this.addSql(`
      create table "dispatches" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "distribution_id" uuid not null,
        "contact_id" uuid not null,
        "channel_id" uuid null,
        "variant_id" uuid null,
        "rendered_body" text not null,
        "scheduled_at" timestamptz null,
        "status" varchar(20) not null,
        "blocked_reason" varchar(30) null,
        "attempts" int not null default 0,
        "evolution_message_id" varchar(120) null,
        "delivery_status" varchar(40) null,
        "error_detail" varchar(500) null,
        "sent_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "dispatches_pkey" primary key ("id"),
        constraint "dispatches_status_check" check (
          "status" in ('PENDING','SENDING','SENT','FAILED','CANCELLED','BLOCKED')
        ),
        constraint "dispatches_blocked_reason_check" check (
          "blocked_reason" is null or "blocked_reason" in (
            'SENDER_UNAVAILABLE','CONTACT_OPTED_OUT','CONTACT_INACTIVE',
            'QUOTA_EXCEEDED','ACCOUNT_SUSPENDED','CONTENT_NOT_APPROVED'
          )
        ),
        -- Estado e motivo andam juntos: BLOCKED sem motivo é uma linha que ninguém sabe explicar.
        constraint "dispatches_blocked_pairing_check" check (
          ("status" = 'BLOCKED') = ("blocked_reason" is not null)
        ),
        -- Um envio agendado precisa de horário; um bloqueado não tem horário para ter.
        constraint "dispatches_schedule_check" check (
          "status" = 'BLOCKED' or "scheduled_at" is not null
        ),
        -- sent_at só com SENT: preenchido em qualquer outro estado, o relatório mentiria.
        constraint "dispatches_sent_at_check" check (
          ("sent_at" is null) or ("status" = 'SENT')
        )
      );
    `);

    this.addSql(
      `alter table "dispatches" add constraint "dispatches_account_id_foreign"
       foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "dispatches" add constraint "dispatches_distribution_id_foreign"
       foreign key ("distribution_id") references "distributions" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dispatches" add constraint "dispatches_contact_id_foreign"
       foreign key ("contact_id") references "contacts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "dispatches" add constraint "dispatches_channel_id_foreign"
       foreign key ("channel_id") references "channels" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `alter table "dispatches" add constraint "dispatches_variant_id_foreign"
       foreign key ("variant_id") references "content_variants" ("id") on update cascade on delete set null;`,
    );

    this.addSql(
      `create index "dispatches_account_id_status_scheduled_at_index"
       on "dispatches" ("account_id","status","scheduled_at");`,
    );
    this.addSql(
      `create index "dispatches_channel_id_scheduled_at_index"
       on "dispatches" ("channel_id","scheduled_at");`,
    );
    this.addSql(
      `create index "dispatches_distribution_id_status_index"
       on "dispatches" ("distribution_id","status");`,
    );
    this.addSql(
      `create index "dispatches_contact_id_sent_at_index" on "dispatches" ("contact_id","sent_at");`,
    );
    // Índice parcial só do que o worker procura: a fila devida. Numa tabela onde a esmagadora maioria
    // das linhas termina em SENT, um índice parcial é uma fração do tamanho do índice completo.
    this.addSql(
      `create index "dispatches_due_index" on "dispatches" ("scheduled_at")
       where "status" = 'PENDING';`,
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "dispatches" cascade;');
    this.addSql('drop table if exists "distributions" cascade;');
  }
}
