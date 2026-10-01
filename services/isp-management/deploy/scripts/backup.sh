#!/usr/bin/env bash
# Logical backup of the ISP database. Secrets are NOT included: the env file, the
# DB passwords and the encryption key are backed up separately by the owner
# (docs/BACKUP-RESTORE.md). TOTP seeds inside the dump are AES-GCM ciphertext.
#   backup.sh [label]
# If BACKUP_AGE_RECIPIENT is set the dump is encrypted with `age` (recommended: it
# holds customer contact details). Retention: 14 daily + 8 weekly.
. "$(dirname "$0")/lib.sh"
require_env_file
LABEL="${1:-daily}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/isp-$LABEL-$STAMP.dump"

log "dumping to $OUT"
"${COMPOSE[@]}" exec -T db pg_dump -U isp_owner -d isp -Fc --no-owner >"$OUT"
[ -s "$OUT" ] || { rm "$OUT"; die "empty dump"; }

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null || die "BACKUP_AGE_RECIPIENT set but age is not installed"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$OUT.age" "$OUT" && rm "$OUT"
  OUT="$OUT.age"
else
  log "WARNING: BACKUP_AGE_RECIPIENT is not set; the dump is stored unencrypted (mode 600)"
fi
sha256sum "$OUT" >"$OUT.sha256"

# Retention (only files this script created).
find "$BACKUP_DIR" -maxdepth 1 -name 'isp-daily-*' -mtime +14 -type f -delete
find "$BACKUP_DIR" -maxdepth 1 -name 'isp-weekly-*' -mtime +56 -type f -delete
[ "$(date -u +%u)" = "7" ] && cp "$OUT" "${OUT/-$LABEL-/-weekly-}" 2>/dev/null || true
log "backup complete: $OUT"
