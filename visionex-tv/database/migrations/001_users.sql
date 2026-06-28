-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Users & Auth
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast text search

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  locale        TEXT        NOT NULL DEFAULT 'en',
  region        TEXT        NOT NULL DEFAULT 'eu',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  role          TEXT        NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin', 'moderator')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- ── Subscriptions ────────────────────────────────────────────────────────────
CREATE TABLE tv_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan        TEXT        NOT NULL DEFAULT 'monthly'
                          CHECK (plan IN ('trial', 'monthly', 'annual')),
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_subscriptions_user    ON tv_subscriptions (user_id);
CREATE INDEX idx_tv_subscriptions_expires ON tv_subscriptions (expires_at)
  WHERE status = 'active';

-- ── Refresh tokens ───────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user   ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expire ON refresh_tokens (expires_at);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
