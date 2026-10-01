#!/usr/bin/env bash
# Exit 0 only if the API answers /readiness on loopback. `--wait N` retries for N seconds.
. "$(dirname "$0")/lib.sh"
WAIT=0
[ "${1:-}" = "--wait" ] && WAIT="${2:-30}"
deadline=$(( $(date +%s) + WAIT ))
while :; do
  body="$(curl -fsS --max-time 4 http://127.0.0.1:8443/readiness 2>/dev/null || true)"
  if [ "$body" = '{"status":"healthy"}' ]; then log "healthy"; exit 0; fi
  [ "$(date +%s)" -ge "$deadline" ] && { log "unhealthy"; exit 1; }
  sleep 3
done
