#!/usr/bin/env bash
# Return api + worker to the previous image. Does NOT reverse migrations: each
# migration is additive; a destructive down-migration needs a restore (docs/BACKUP-RESTORE.md).
. "$(dirname "$0")/lib.sh"
require_env_file
docker image inspect visionex-isp:previous >/dev/null 2>&1 || die "no previous image to roll back to"
docker image tag visionex-isp:previous visionex-isp:current
"${COMPOSE[@]}" up -d --force-recreate api worker
"$(dirname "$0")/healthcheck.sh" --wait 60
log "rolled back to the previous image"
