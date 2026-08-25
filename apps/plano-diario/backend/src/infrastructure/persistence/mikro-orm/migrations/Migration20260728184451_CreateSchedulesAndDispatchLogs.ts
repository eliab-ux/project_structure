import { Migration } from '@mikro-orm/migrations';

export class Migration20260728184451_CreateSchedulesAndDispatchLogs extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "schedules" ("id" uuid not null, "user_id" uuid not null, "group_jid" varchar(120) not null, "group_name" varchar(255) not null, "send_time" time(0) not null, "timezone" varchar(64) not null default 'America/Sao_Paulo', "plan_start_date" date not null, "day_offset" int not null default 0, "message_template" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "schedules_pkey" primary key ("id"));`,
    );
    this.addSql(
      `alter table "schedules" add constraint "schedules_user_id_unique" unique ("user_id");`,
    );
    this.addSql(`create index "schedules_is_active_index" on "schedules" ("is_active");`);

    this.addSql(
      `create table "dispatch_logs" ("id" uuid not null, "user_id" uuid not null, "schedule_id" uuid not null, "reference_date" date not null, "day_number" int null, "video_id" varchar(32) null, "message_sent" text null, "status" varchar(20) not null, "error_reason" text null, "attempts" int not null default 0, "sent_at" timestamptz null, "trigger" varchar(20) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, constraint "dispatch_logs_pkey" primary key ("id"));`,
    );
    this.addSql(`create index "dispatch_logs_user_id_index" on "dispatch_logs" ("user_id");`);
    this.addSql(`create index "dispatch_logs_status_index" on "dispatch_logs" ("status");`);
    this.addSql(`create index "dispatch_logs_created_at_index" on "dispatch_logs" ("created_at");`);

    this.addSql(
      `alter table "schedules" add constraint "schedules_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );

    this.addSql(
      `alter table "dispatch_logs" add constraint "dispatch_logs_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "dispatch_logs" add constraint "dispatch_logs_schedule_id_foreign" foreign key ("schedule_id") references "schedules" ("id") on update cascade on delete cascade;`,
    );

    // ─────────────────────────────────────────────────────────────────────────────────────────
    // O CORAÇÃO DA IDEMPOTÊNCIA (spec §4.6 / §8.2).
    //
    // Índice UNIQUE PARCIAL: no máximo um envio AGENDADO por (agendamento, data local). O
    // MikroORM não expressa índice parcial via decorator, então é escrito à mão aqui.
    //
    // Ser parcial (`where trigger = 'scheduled'`) é essencial: o "Enviar agora" grava
    // `trigger = 'manual'` e fica FORA da restrição — assim um teste manual nunca consome nem
    // é bloqueado pelo envio do dia.
    //
    // É o banco que garante isso, não a aplicação: dois workers no mesmo minuto furariam
    // qualquer verificação feita em memória.
    // ─────────────────────────────────────────────────────────────────────────────────────────
    this.addSql(
      `create unique index "dispatch_logs_scheduled_once_per_day" on "dispatch_logs" ("schedule_id", "reference_date") where "trigger" = 'scheduled';`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "dispatch_logs" drop constraint "dispatch_logs_schedule_id_foreign";`);

    this.addSql(`drop table if exists "schedules" cascade;`);

    this.addSql(`drop table if exists "dispatch_logs" cascade;`);
  }
}
