-- ISP management schema. Lives in its OWN dedicated database, never in the
-- public VisionEX Supabase project. Idempotent; the down migration is
-- 0001_init.down.sql (not run automatically).

CREATE TABLE IF NOT EXISTS admin_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username         text NOT NULL,
  display_name     text NOT NULL DEFAULT '',
  role             text NOT NULL CHECK (role IN ('SUPER_ADMIN','ADMIN','READ_ONLY_ADMIN')),
  status           text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  password_hash    text NOT NULL,
  totp_secret_enc  text,
  totp_enabled     boolean NOT NULL DEFAULT false,
  totp_last_step   bigint NOT NULL DEFAULT 0,
  failed_attempts  integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_username_uq ON admin_users (lower(username));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  csrf_token    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  ip_address    text,
  user_agent    text,
  revoked_at    timestamptz,
  limited       boolean NOT NULL DEFAULT false -- true until MFA is enrolled/verified
);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions (admin_id);

CREATE TABLE IF NOT EXISTS whatsapp_admins (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number           text NOT NULL CHECK (phone_number ~ '^[0-9]{8,15}$'),
  name                   text NOT NULL,
  status                 text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','DISABLED')),
  role                   text NOT NULL DEFAULT 'WHATSAPP_ADMIN' CHECK (role IN ('SUPER_ADMIN','ADMIN','WHATSAPP_ADMIN','READ_ONLY_ADMIN')),
  enrollment_code_hash   text,
  enrollment_expires_at  timestamptz,
  totp_secret_enc        text,
  totp_last_step         bigint NOT NULL DEFAULT 0,
  created_by             uuid REFERENCES admin_users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_admins_phone_uq ON whatsapp_admins (phone_number);

CREATE TABLE IF NOT EXISTS wa_sessions (
  admin_id       uuid PRIMARY KEY REFERENCES whatsapp_admins(id) ON DELETE CASCADE,
  unlocked_until timestamptz,
  context        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Webhook replay / duplicate-delivery protection.
CREATE TABLE IF NOT EXISTS wa_inbound (
  message_id   text PRIMARY KEY,
  received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_inbound_received_idx ON wa_inbound (received_at);

-- Cache of the authoritative PI data. State-changing actions never trust it.
CREATE TABLE IF NOT EXISTS customers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_customer_id text NOT NULL UNIQUE,
  username             text NOT NULL,
  full_name            text,
  phone                text,
  email                text,
  address              text,
  status               text NOT NULL DEFAULT 'UNKNOWN',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_username_idx ON customers (lower(username));
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (lower(full_name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS services (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_service_id text NOT NULL,
  username            text NOT NULL,
  service_type        text,
  package             text,
  speed               text,
  status              text NOT NULL DEFAULT 'UNKNOWN',
  activation_date     timestamptz,
  expiration_date     timestamptz,
  suspension_date     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, external_service_id)
);
CREATE INDEX IF NOT EXISTS services_expiration_idx ON services (expiration_date);

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  external_payment_id text NOT NULL,
  amount              numeric(12,2) NOT NULL,
  currency            text NOT NULL DEFAULT 'USD',
  payment_date        timestamptz,
  due_date            timestamptz,
  status              text NOT NULL DEFAULT 'UNKNOWN',
  method              text,
  notes               text,
  UNIQUE (customer_id, external_payment_id)
);
CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments (customer_id, payment_date DESC);

CREATE TABLE IF NOT EXISTS radius_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  username            text NOT NULL,
  radius_identifier   text,
  status              text NOT NULL DEFAULT 'UNKNOWN',
  last_seen           timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (customer_id, username)
);

-- Two-step (request, confirm) state-changing actions. idempotency_key makes a
-- redelivered request return the same row instead of a second operation.
CREATE TABLE IF NOT EXISTS pending_actions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      text NOT NULL UNIQUE,
  actor_type           text NOT NULL CHECK (actor_type IN ('ADMIN_USER','WHATSAPP_ADMIN')),
  actor_id             uuid NOT NULL,
  source               text NOT NULL CHECK (source IN ('WEB','WHATSAPP')),
  action               text NOT NULL,
  customer_external_id text NOT NULL,
  params               jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_snapshot       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status               text NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING','EXECUTING','SUCCEEDED','FAILED','CANCELLED','EXPIRED')),
  expires_at           timestamptz NOT NULL,
  result               jsonb,
  error_code           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  executed_at          timestamptz
);
CREATE INDEX IF NOT EXISTS pending_actions_status_idx ON pending_actions (status, expires_at);

-- Append-only, hash-chained. The application role is granted INSERT/SELECT
-- only (see scripts/provision-db.sh); the triggers protect against anyone else.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigserial PRIMARY KEY,
  actor_type  text NOT NULL,
  actor_id    text,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  result      text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  request_id  text,
  prev_hash   text NOT NULL,
  hash        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_target_idx ON audit_logs (target_id, created_at DESC);

CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_immutable();

CREATE TABLE IF NOT EXISTS system_events (
  id          bigserial PRIMARY KEY,
  event_type  text NOT NULL,
  severity    text NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','CRITICAL')),
  message     text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS system_events_created_idx ON system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_type_idx ON system_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

CREATE TABLE IF NOT EXISTS heartbeats (
  component text PRIMARY KEY,
  beat_at   timestamptz NOT NULL DEFAULT now(),
  info      jsonb NOT NULL DEFAULT '{}'::jsonb
);
