import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 8 — `conversations`, `messages` e `quick_replies` (§4).
 *
 * Três decisões estruturais:
 *
 *  1. **`unique (account_id, contact_id)` em `conversations`.** É §10.1 no banco: "um item por conversa,
 *     nunca por mensagem". Sem essa restrição, dois webhooks simultâneos do mesmo contato criam duas
 *     linhas e o operador responde a mesma pessoa duas vezes — o exato problema que a regra evita.
 *
 *  2. **`messages.channel_id` sem nenhuma amarra à conversa.** É de propósito: a conversa migra de chip
 *     (§6.4 item 6), cada mensagem guarda o número por onde ela realmente passou. Uma FK para o canal da
 *     conversa tornaria a mentira representável.
 *
 *  3. **CHECK amarrando `sent_by` a OUTBOUND.** Uma mensagem recebida com autor é impossível, e a
 *     trilha de §11 depende de `sent_by` significar exatamente "quem respondeu".
 */
export class Migration20260804210000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table "conversations" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "contact_id" uuid not null,
        "channel_id" uuid not null,
        "status" varchar(20) not null,
        "priority" varchar(10) not null default 'NORMAL',
        "intent_class" varchar(20) null,
        "last_inbound_at" timestamptz null,
        "last_outbound_at" timestamptz null,
        "locked_by" uuid null,
        "locked_at" timestamptz null,
        "unread_count" int not null default 0,
        "resolved_by" uuid null,
        "resolved_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        constraint "conversations_pkey" primary key ("id"),
        constraint "conversations_status_check" check (
          "status" in ('PENDING_REPLY','IN_PROGRESS','RESOLVED','ARCHIVED')
        ),
        constraint "conversations_priority_check" check ("priority" in ('NORMAL','HIGH')),
        constraint "conversations_intent_check" check (
          "intent_class" is null or "intent_class" in
            ('OPT_OUT','ACKNOWLEDGMENT','WRONG_NUMBER','QUESTION','COMPLAINT','OTHER')
        ),
        -- Trava e horário da trava andam juntos: um sem o outro tornaria o TTL incalculável.
        constraint "conversations_lock_pairing_check" check (
          ("locked_by" is null) = ("locked_at" is null)
        )
      );
    `);

    this.addSql(
      `alter table "conversations" add constraint "conversations_account_id_foreign"
       foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "conversations" add constraint "conversations_contact_id_foreign"
       foreign key ("contact_id") references "contacts" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "conversations" add constraint "conversations_channel_id_foreign"
       foreign key ("channel_id") references "channels" ("id") on update cascade;`,
    );
    // §10.1 no banco.
    this.addSql(
      `alter table "conversations" add constraint "conversations_account_id_contact_id_unique"
       unique ("account_id","contact_id");`,
    );
    this.addSql(
      `create index "conversations_account_id_status_priority_index"
       on "conversations" ("account_id","status","priority");`,
    );
    this.addSql(`create index "conversations_channel_id_index" on "conversations" ("channel_id");`);
    // Índice parcial da fila de trabalho: é a consulta que a tela abre a cada poucos segundos.
    this.addSql(
      `create index "conversations_queue_index" on "conversations" ("priority" desc,"last_inbound_at")
       where "status" in ('PENDING_REPLY','IN_PROGRESS');`,
    );

    this.addSql(`
      create table "messages" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "conversation_id" uuid not null,
        "contact_id" uuid not null,
        "channel_id" uuid not null,
        "direction" varchar(10) not null,
        "kind" varchar(20) not null,
        "body" text null,
        "media_storage_key" varchar(500) null,
        "evolution_message_id" varchar(120) null,
        "delivery_status" varchar(40) null,
        "dispatch_id" uuid null,
        "sent_by" uuid null,
        "occurred_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        constraint "messages_pkey" primary key ("id"),
        constraint "messages_direction_check" check ("direction" in ('INBOUND','OUTBOUND')),
        constraint "messages_kind_check" check (
          "kind" in ('TEXT','IMAGE','AUDIO','VIDEO','DOCUMENT','STICKER','OTHER')
        ),
        -- Autor só existe em mensagem enviada: recebida com sent_by é impossível.
        constraint "messages_sent_by_check" check (
          "sent_by" is null or "direction" = 'OUTBOUND'
        ),
        -- Mesma coisa para dispatch: uma mensagem recebida não vem de uma distribuição.
        constraint "messages_dispatch_check" check (
          "dispatch_id" is null or "direction" = 'OUTBOUND'
        )
      );
    `);

    this.addSql(
      `alter table "messages" add constraint "messages_account_id_foreign"
       foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "messages" add constraint "messages_conversation_id_foreign"
       foreign key ("conversation_id") references "conversations" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "messages" add constraint "messages_contact_id_foreign"
       foreign key ("contact_id") references "contacts" ("id") on update cascade on delete cascade;`,
    );
    this.addSql(
      `alter table "messages" add constraint "messages_channel_id_foreign"
       foreign key ("channel_id") references "channels" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "messages" add constraint "messages_dispatch_id_foreign"
       foreign key ("dispatch_id") references "dispatches" ("id") on update cascade on delete set null;`,
    );
    this.addSql(
      `create index "messages_conversation_id_occurred_at_index"
       on "messages" ("conversation_id","occurred_at");`,
    );
    this.addSql(
      `create index "messages_account_id_occurred_at_index" on "messages" ("account_id","occurred_at");`,
    );
    // (channel, direction, occurred_at) é o índice do inbound_rate do throttle (§2.1).
    this.addSql(
      `create index "messages_channel_id_direction_occurred_at_index"
       on "messages" ("channel_id","direction","occurred_at");`,
    );
    // Único parcial: o id do provedor é a chave de idempotência do webhook, e é nulo em mensagens que
    // ainda não têm ack. Um único total recusaria a segunda mensagem sem id.
    this.addSql(
      `create unique index "messages_evolution_message_id_unique" on "messages" ("evolution_message_id")
       where "evolution_message_id" is not null;`,
    );

    this.addSql(`
      create table "quick_replies" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "title" varchar(120) not null,
        "body" text not null,
        "tags" jsonb not null default '[]'::jsonb,
        "created_by" uuid not null,
        "usage_count" int not null default 0,
        "created_at" timestamptz not null default now(),
        constraint "quick_replies_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `alter table "quick_replies" add constraint "quick_replies_account_id_foreign"
       foreign key ("account_id") references "accounts" ("id") on update cascade;`,
    );
    this.addSql(
      `alter table "quick_replies" add constraint "quick_replies_created_by_foreign"
       foreign key ("created_by") references "users" ("id") on update cascade;`,
    );
    this.addSql(`create index "quick_replies_account_id_index" on "quick_replies" ("account_id");`);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "quick_replies" cascade;');
    this.addSql('drop table if exists "messages" cascade;');
    this.addSql('drop table if exists "conversations" cascade;');
  }
}
