#!/usr/bin/env bash
# Build and roll out a specific commit of the ISP service. Idempotent.
#   deploy.sh <git-ref>          # e.g. a commit SHA that already passed CI
# Keeps the previous image tagged `previous` so rollback.sh is instant.
. "$(dirname "$0")/lib.sh"
require_env_file
REF="${1:?usage: deploy.sh <git-ref>}"
APP="$ISP_HOME/app"
[ -d "$APP/.git" ] || die "$APP is not a checkout (see docs/DEPLOYMENT.md)"

log "fetching $REF"
git -C "$APP" fetch --quiet origin
git -C "$APP" checkout --quiet --detach "$REF"
SHA="$(git -C "$APP" rev-parse --short HEAD)"

# Take a backup first: a migration is the one step that is hard to undo.
"$(dirname "$0")/backup.sh" pre-deploy-"$SHA"

log "building image visionex-isp:$SHA"
docker image tag visionex-isp:current visionex-isp:previous 2>/dev/null || true
docker build -q -f "$APP/services/isp-management/deploy/Dockerfile" -t "visionex-isp:$SHA" -t visionex-isp:current "$APP/services/isp-management"

log "starting database"
"${COMPOSE[@]}" up -d db
log "running migrations (owner role, one-shot)"
"${COMPOSE[@]}" run --rm migrate
log "applying least-privilege grants"
"$(dirname "$0")/provision-db.sh"

log "rolling the services"
"${COMPOSE[@]}" up -d api worker
"$(dirname "$0")/healthcheck.sh" --wait 60 || {
  log "health check failed; rolling back"
  "$(dirname "$0")/rollback.sh"
  exit 1
}
log "deployed $SHA"
