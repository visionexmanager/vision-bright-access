#!/usr/bin/env bash
# Create/refresh the application database role with least privilege. Run as the
# owner after every migration (deploy.sh does). The application NEVER connects as
# the owner or a superuser, and it can only INSERT/SELECT on audit_logs, so even a
# compromised app cannot rewrite history.
. "$(dirname "$0")/lib.sh"
require_env_file
APP_PW_FILE="${ISP_APP_DB_PASSWORD_FILE:-/etc/visionex-isp/db_app_password}"
[ -r "$APP_PW_FILE" ] || die "missing $APP_PW_FILE"
APP_PW="$(cat "$APP_PW_FILE")"

"${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U isp_owner -d isp -v app_pw="$APP_PW" <<'SQL'
SELECT format('CREATE ROLE isp_app LOGIN PASSWORD %L', :'app_pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'isp_app') \gexec
SELECT format('ALTER ROLE isp_app PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'app_pw') \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO isp_app;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM isp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO isp_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM isp_app;
REVOKE ALL ON schema_migrations FROM isp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO isp_app;
SQL
log "grants applied"
