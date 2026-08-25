-- Ecoa — schema idempotente (PostgreSQL / Supabase).
-- Artefato versionado do schema (ECOA_SPEC §5). Seguro para reexecução: usa IF NOT EXISTS.
-- Toda tabela de negócio tem owner_id (fk -> app_user) = o isolamento de tenant.

-- ── Tenant / identidade própria ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_user (
  id                      uuid PRIMARY KEY,
  email                   varchar(255) NOT NULL UNIQUE,
  name                    varchar(100) NOT NULL,
  password_hash           varchar(255) NOT NULL,
  role                    varchar(20)  NOT NULL DEFAULT 'user',
  active                  boolean      NOT NULL DEFAULT true,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  reset_token             varchar(128),
  reset_token_expires_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_app_user_reset_token ON app_user (reset_token);

-- ── Conexão do Instagram do tenant ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS instagram_connection (
  id                      uuid PRIMARY KEY,
  owner_id                uuid NOT NULL UNIQUE REFERENCES app_user (id) ON DELETE CASCADE,
  ig_user_id              varchar(64) NOT NULL UNIQUE,      -- unique GLOBAL
  username                varchar(255) NOT NULL,
  access_token_encrypted  text NOT NULL,                    -- AES-256-GCM em repouso
  token_expires_at        timestamptz,
  status                  varchar(20) NOT NULL DEFAULT 'connected',
  connected_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Lista de acompanhamento ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watched_account (
  id          uuid PRIMARY KEY,
  owner_id    uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  handle      varchar(30) NOT NULL,
  ig_user_id  varchar(64),
  active      boolean NOT NULL DEFAULT true,
  added_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_watched_account_owner_handle UNIQUE (owner_id, handle)
);

-- ── Mídias do tenant ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS own_media (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  ig_media_id   varchar(255) NOT NULL,
  permalink     varchar(500) NOT NULL,
  media_type    varchar(50)  NOT NULL,
  caption       text,
  thumbnail_url varchar(1000),
  published_at  timestamptz  NOT NULL,
  CONSTRAINT uq_own_media_owner_igid UNIQUE (owner_id, ig_media_id)
);
CREATE INDEX IF NOT EXISTS idx_own_media_owner_published ON own_media (owner_id, published_at);

-- ── Snapshots de métricas (série temporal) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS media_insight_snapshot (
  id            uuid PRIMARY KEY,
  owner_id      uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  own_media_id  uuid NOT NULL REFERENCES own_media (id) ON DELETE CASCADE,
  captured_at   timestamptz NOT NULL DEFAULT now(),
  reach         integer NOT NULL DEFAULT 0,
  impressions   integer NOT NULL DEFAULT 0,
  likes         integer NOT NULL DEFAULT 0,
  comments      integer NOT NULL DEFAULT 0,
  saved         integer NOT NULL DEFAULT 0,
  shares_count  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_snapshot_owner_media_captured
  ON media_insight_snapshot (owner_id, own_media_id, captured_at);

-- ── Detecções (repostagens/menções) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS detection (
  id                  uuid PRIMARY KEY,
  owner_id            uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  own_media_id        uuid REFERENCES own_media (id) ON DELETE SET NULL,
  watched_account_id  uuid REFERENCES watched_account (id) ON DELETE SET NULL,
  source_username     varchar(255) NOT NULL,
  -- 'caption_mention' | 'comment_mention' | 'tag' — ver DetectionType no domínio.
  -- NÃO existe story_mention: a Meta não expõe menções em Stories nesta API.
  detection_type      varchar(20)  NOT NULL,
  detected_at         timestamptz  NOT NULL DEFAULT now(),
  permalink           varchar(500),
  seen                boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_detection_owner_detected ON detection (owner_id, detected_at);

-- ── Auditoria/dedup de webhooks ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_event (
  id                uuid PRIMARY KEY,
  external_id       varchar(255) NOT NULL UNIQUE,
  resolved_owner_id uuid REFERENCES app_user (id) ON DELETE SET NULL,
  payload_hash      varchar(64) NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed         boolean NOT NULL DEFAULT false
);
