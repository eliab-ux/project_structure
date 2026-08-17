import { Migration } from '@mikro-orm/migrations';

/**
 * FASE 1 — fundação, conta e acesso. Tabelas: `account` (§4.1), `business_hour` (§4.1.1),
 * `machine` (§4.2), `user` (§4.3) e `password_reset_code`, o mecanismo da recuperação de senha
 * por WhatsApp exigida pela Fase 1.
 *
 * Decisões que valem registro, porque não estão literalmente na spec e alguém vai perguntar:
 *
 * 1. `account` NÃO tem `account_id`. A spec (§4) diz que toda tabela de negócio tem `account_id`;
 *    `account` é o próprio tenant, então o seu `id` É a chave de escopo. Acrescentar um
 *    `account_id` apontando para si mesma seria uma coluna que só pode ter um valor.
 *
 * 2. `user.email` é único GLOBALMENTE, não por conta. Isso é imposto pelo login: a spec (§7,
 *    Fase 1) manda autenticar por e-mail + senha, sem informar a conta. Se o mesmo e-mail
 *    pudesse existir em duas contas, o login não teria como decidir em qual autenticar — e a
 *    "solução" seria pedir a conta na tela de login, que é pior. O `account_id` continua na
 *    tabela e continua sendo o escopo de toda consulta.
 *
 * 3. Nenhuma tabela de fase futura aqui. `customer`, `fabric`, `pre_order`, `schedule_entry`,
 *    `reservation`, `cut`, `waiting_list_entry` e as três do financeiro (§4.13–4.15) chegam nas
 *    suas fases (regra §0.2).
 *
 * 4. `role` é varchar com CHECK em vez de enum nativo do Postgres: acrescentar valor a um enum
 *    nativo é DDL, e o conjunto (`owner | admin | modelista`) é fechado pela segregação de função
 *    da §5. O CHECK dá a mesma garantia sem o custo de migration para mexer no domínio.
 */
export class Migration20260814130000 extends Migration {
  async up(): Promise<void> {
    /**
     * Tipo de intervalo sobre `time`, para a constraint de não-sobreposição das janelas de
     * funcionamento. O Postgres traz `tsrange`/`daterange` embutidos, mas nenhum range de `time`
     * — e a alternativa (converter para timestamp somando uma data fixa dentro da constraint)
     * esconde a intenção atrás de aritmética.
     *
     * Range type ganha suporte GiST automaticamente, que é o que a EXCLUDE precisa.
     * O bloco `exception` existe porque `create type` não aceita `if not exists`.
     */
    this.addSql(`
      do $$ begin
        create type timerange as range (subtype = time);
      exception when duplicate_object then null;
      end $$;
    `);

    // ==== account (§4.1) — o dono da operação, o tenant ====
    // Sem preço da hora (é da máquina, §4.2) e sem opens_at/closes_at (é `business_hour`, §4.1.1).
    this.addSql(`
      create table "account" (
        "id" uuid not null default gen_random_uuid(),
        "name" varchar(200) not null,
        "city" varchar(120) not null,
        "report_owner_name" varchar(200) null,
        "report_owner_role" varchar(120) null,
        "report_owner_phone" varchar(20) null,
        "report_owner_email" varchar(255) null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "account_pkey" primary key ("id")
      );
    `);

    // ==== business_hour (§4.1.1) — janelas de funcionamento ====
    // Janelas ABERTAS, não intervalos fechados: o almoço é a ausência de janela entre duas linhas.
    // Assim não existe conflito possível entre "está aberto" e "está em intervalo", e a
    // quantidade de intervalos por dia é livre.
    this.addSql(`
      create table "business_hour" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "weekday" smallint not null,
        "starts_at" time not null,
        "ends_at" time not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "business_hour_pkey" primary key ("id"),
        constraint "business_hour_weekday_check" check ("weekday" between 0 and 6),
        constraint "business_hour_range_ordered" check ("ends_at" > "starts_at"),
        constraint "business_hour_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(
      `create index "business_hour_account_id_weekday_index" on "business_hour" ("account_id", "weekday");`,
    );
    // Janelas do mesmo dia não podem se sobrepor — no banco além da validação de aplicação, como
    // a spec exige (§4.1.1). '[)' porque 11:30 fecha uma janela e abre a seguinte sem colidir.
    // Depende de `btree_gist` (criada na baseline) para os operadores `=` de uuid e smallint.
    this.addSql(`
      alter table "business_hour" add constraint "business_hour_no_overlap"
        exclude using gist (
          "account_id" with =,
          "weekday" with =,
          timerange("starts_at", "ends_at", '[)') with &&
        );
    `);

    // ==== machine (§4.2) — a agenda é POR máquina, e o PREÇO é da máquina ====
    this.addSql(`
      create table "machine" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(200) not null,
        "model" varchar(200) null,
        "hour_price_cents" int not null,
        "is_active" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "machine_pkey" primary key ("id"),
        constraint "machine_hour_price_positive" check ("hour_price_cents" > 0),
        constraint "machine_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "machine_account_id_index" on "machine" ("account_id");`);

    // ==== user (§4.3) ====
    // A equipe É a lista de usuários: não existe pessoa sem login, e toda autoria referencia
    // `user_id`. Desligar é `is_active = false`, nunca apagar — exclusão quebraria a autoria dos
    // registros históricos.
    //
    // `phone` é NOT NULL sem exceção: a recuperação de senha é um código no WhatsApp (regra 9 do
    // CLAUDE.md), e usuário sem número é usuário que perde a conta no primeiro esquecimento.
    // O tamanho 20 cobre o E.164 (máximo 15 dígitos + '+') com folga.
    //
    // `must_change_password` e `last_login_at` não são invenção: a spec (§4.3) manda o sistema
    // exigir troca de senha no primeiro login, e a tela de Equipe do protótipo tem a coluna
    // "Último acesso". Ambos precisam de estado; nenhum dos dois é derivável de outra coluna.
    this.addSql(`
      create table "user" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "name" varchar(200) not null,
        "email" varchar(255) not null,
        "phone" varchar(20) not null,
        "password_hash" varchar(100) not null,
        "role" varchar(20) not null,
        "is_active" boolean not null default true,
        "must_change_password" boolean not null default true,
        "last_login_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "user_pkey" primary key ("id"),
        constraint "user_email_unique" unique ("email"),
        constraint "user_role_check" check ("role" in ('owner', 'admin', 'modelista')),
        constraint "user_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict
      );
    `);
    this.addSql(`create index "user_account_id_index" on "user" ("account_id");`);

    // ==== password_reset_code — código de 6 dígitos enviado no WhatsApp ====
    // As colunas saem uma a uma das regras do CLAUDE.md, não de invenção:
    //   code_hash  → guarda-se só o hash (bcrypt); nem dump nem log revelam o valor
    //   expires_at → TTL curto (15 min), definido no domínio porque é regra, não configuração
    //   used_at    → uso único, e o índice parcial abaixo depende dele
    //   attempts   → máximo de 5 tentativas por código, contadas ANTES de recusar
    //   sent_at    → base do limite por hora, que conta ENVIOS e não tentativas: contar tentativa
    //                faria uma falha de infraestrutura consumir a cota do usuário
    // Não tem `updated_at`: a linha nasce, é marcada como usada e morre. Não há edição.
    this.addSql(`
      create table "password_reset_code" (
        "id" uuid not null default gen_random_uuid(),
        "account_id" uuid not null,
        "user_id" uuid not null,
        "code_hash" varchar(100) not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "sent_at" timestamptz null,
        "attempts" int not null default 0,
        "created_at" timestamptz not null default now(),
        constraint "password_reset_code_pkey" primary key ("id"),
        constraint "password_reset_code_attempts_check" check ("attempts" >= 0),
        constraint "password_reset_code_account_id_foreign" foreign key ("account_id")
          references "account" ("id") on update cascade on delete restrict,
        constraint "password_reset_code_user_id_foreign" foreign key ("user_id")
          references "user" ("id") on update cascade on delete cascade
      );
    `);
    this.addSql(
      `create index "password_reset_code_account_id_index" on "password_reset_code" ("account_id");`,
    );
    // Caminho quente: "o último código vivo deste usuário" (só pode haver um). Parcial em
    // `used_at is null` porque código usado nunca é consultado de novo — o índice fica pequeno
    // para sempre, mesmo depois de anos de linha acumulada.
    this.addSql(`
      create index "password_reset_code_live_index"
        on "password_reset_code" ("user_id", "created_at" desc)
        where "used_at" is null;
    `);
    // Base do limite por hora: conta os ENVIOS de um usuário numa janela.
    this.addSql(`
      create index "password_reset_code_sent_index"
        on "password_reset_code" ("user_id", "sent_at");
    `);
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "password_reset_code" cascade;');
    this.addSql('drop table if exists "user" cascade;');
    this.addSql('drop table if exists "machine" cascade;');
    this.addSql('drop table if exists "business_hour" cascade;');
    this.addSql('drop table if exists "account" cascade;');
    this.addSql('drop type if exists timerange;');
  }
}
