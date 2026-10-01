#!/usr/bin/env bash
# Restore a backup. Safe by default: it restores into a SCRATCH database
# (isp_restore_test), verifies it, and drops it. Restoring over production needs
# the explicit flag AND a typed confirmation.
#   restore.sh <dump-file> [--verify-only]        # default: scratch restore + checks
#   restore.sh <dump-file> --into-production      # destructive; stop api/worker first
. "$(dirname "$0")/lib.sh"
require_env_file
FILE="${1:?usage: restore.sh <dump-file> [--verify-only|--into-production]}"
MODE="${2:---verify-only}"
[ -f "$FILE" ] || die "no such file: $FILE"
[ -f "$FILE.sha256" ] && { (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256") || die "checksum mismatch"; }

SRC="$FILE"
if [[ "$FILE" == *.age ]]; then
  : "${AGE_IDENTITY:?set AGE_IDENTITY to the age private key file}"
  SRC="$(mktemp)"; trap 'rm -f "$SRC"' EXIT
  age -d -i "$AGE_IDENTITY" -o "$SRC" "$FILE"
fi

psql_db() { "${COMPOSE[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U isp_owner -d "$1" -tA -c "$2"; }

case "$MODE" in
  --verify-only)
    psql_db postgres "DROP DATABASE IF EXISTS isp_restore_test" >/dev/null
    psql_db postgres "CREATE DATABASE isp_restore_test" >/dev/null
    "${COMPOSE[@]}" exec -T db pg_restore -U isp_owner -d isp_restore_test --no-owner --exit-on-error <"$SRC"
    tables="$(psql_db isp_restore_test "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
    audit="$(psql_db isp_restore_test "SELECT count(*) FROM audit_logs")"
    admins="$(psql_db isp_restore_test "SELECT count(*) FROM admin_users")"
    log "restore OK: $tables tables, $audit audit rows, $admins admin users"
    [ "$tables" -ge 10 ] || die "too few tables restored"
    psql_db postgres "DROP DATABASE isp_restore_test" >/dev/null
    ;;
  --into-production)
    printf 'This REPLACES the production ISP database. Type the word RESTORE to continue: '
    read -r answer; [ "$answer" = "RESTORE" ] || die "aborted"
    "${COMPOSE[@]}" stop api worker
    psql_db postgres "DROP DATABASE isp" >/dev/null
    psql_db postgres "CREATE DATABASE isp OWNER isp_owner" >/dev/null
    "${COMPOSE[@]}" exec -T db pg_restore -U isp_owner -d isp --no-owner --exit-on-error <"$SRC"
    "$(dirname "$0")/provision-db.sh"
    "${COMPOSE[@]}" up -d api worker
    "$(dirname "$0")/healthcheck.sh" --wait 60
    log "production restored from $FILE"
    ;;
  *) die "unknown mode $MODE" ;;
esac
