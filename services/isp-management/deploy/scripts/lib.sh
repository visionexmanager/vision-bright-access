#!/usr/bin/env bash
# Shared settings for the ISP management scripts. Sourced, never run.
set -euo pipefail

ISP_HOME="${ISP_HOME:-/opt/visionex-isp}"
ISP_ENV_FILE="${ISP_ENV_FILE:-/etc/visionex-isp/isp.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$ISP_HOME/app/services/isp-management/deploy/docker-compose.yml}"
COMPOSE=(docker compose -p visionex-isp --env-file "$ISP_ENV_FILE" -f "$COMPOSE_FILE")
BACKUP_DIR="${BACKUP_DIR:-$ISP_HOME/backups}"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

require_env_file() {
  [ -f "$ISP_ENV_FILE" ] || die "missing $ISP_ENV_FILE (see .env.example for the variable names)"
  # Secrets must not be readable by other users.
  local mode
  mode="$(stat -c '%a' "$ISP_ENV_FILE")"
  [ "$mode" = "600" ] || [ "$mode" = "400" ] || die "$ISP_ENV_FILE must be mode 0600 (is $mode)"
}
