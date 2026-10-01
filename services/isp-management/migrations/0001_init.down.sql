-- Reverses 0001_init.sql. Destroys all data, including the audit trail.
-- Never run against production without a verified backup (docs/BACKUP-RESTORE.md).
DROP TABLE IF EXISTS heartbeats, settings, system_events, audit_logs, pending_actions,
  radius_accounts, payments, services, customers, wa_inbound, wa_sessions,
  whatsapp_admins, admin_sessions, admin_users CASCADE;
DROP FUNCTION IF EXISTS audit_logs_immutable();
