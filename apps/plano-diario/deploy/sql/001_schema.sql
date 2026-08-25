-- Plano Diário — schema completo (Fases 1 e 2), idempotente.
--
-- Quando usar: para criar o schema num banco novo (ex.: o PostgreSQL do Dokploy) sem precisar
-- rodar a CLI do MikroORM dentro do container. Rodar mais de uma vez é seguro.
--
-- Como rodar no Dokploy:
--   Serviço plano-diario (Database) → aba Terminal → psql -U postgres -d plano_diario
--   e cole este arquivo. Ou, de qualquer cliente SQL conectado no banco.
--
-- Alternativa equivalente (se preferir a CLI, dentro do container do backend):
--   npm run migration:up
--
-- IMPORTANTE: o bloco final registra as migrations como já aplicadas em
-- `mikro_orm_migrations`. Sem isso, um `migration:up` posterior tentaria recriar as tabelas
-- e falharia com "relation already exists".

-- ---------------------------------------------------------------------------
-- users  (Fase 1 — Migration20260728143841_CreateUsers)
-- ---------------------------------------------------------------------------
create table if not exists "users" (
  "id"            uuid         not null,
  "email"         varchar(255) not null,
  "password_hash" varchar(255) not null,
  "name"          varchar(120) not null,
  "role"          varchar(20)  not null default 'user',
  "is_active"     boolean      not null default true,
  "created_at"    timestamptz  not null,
  "updated_at"    timestamptz  not null,
  constraint "users_pkey" primary key ("id")
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_email_unique'
  ) then
    alter table "users" add constraint "users_email_unique" unique ("email");
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- daily_videos  (Fase 2 — Migration20260728153113_CreateDailyVideos)
--
-- Catálogo GLOBAL: sem user_id, porque o plano de leitura é o mesmo para todos.
-- `day_number` é a POSIÇÃO na sequência de leituras (a chave que resolve o dia).
-- `title_day_number` é o número lido do título do vídeo — só auditoria, porque a
-- numeração do canal tem furos (96, 97, 275) e um duplicado (218).
-- ---------------------------------------------------------------------------
create table if not exists "daily_videos" (
  "day_number"       int          not null,
  "title_day_number" int          not null,
  "title"            varchar(255) not null,
  "video_id"         varchar(32)  not null,
  "playlist_id"      varchar(64)  not null,
  "published_at"     timestamptz  null,
  "synced_at"        timestamptz  not null,
  constraint "daily_videos_pkey" primary key ("day_number")
);

create index if not exists "daily_videos_title_day_number_index"
  on "daily_videos" ("title_day_number");

-- ---------------------------------------------------------------------------
-- Controle de migrations do MikroORM
-- ---------------------------------------------------------------------------
create table if not exists "mikro_orm_migrations" (
  "id"          serial       primary key,
  "name"        varchar(255),
  "executed_at" timestamptz  default current_timestamp
);

insert into "mikro_orm_migrations" ("name")
select v.name
from (values
  ('Migration20260728143841_CreateUsers'),
  ('Migration20260728153113_CreateDailyVideos')
) as v(name)
where not exists (
  select 1 from "mikro_orm_migrations" m where m.name = v.name
);
