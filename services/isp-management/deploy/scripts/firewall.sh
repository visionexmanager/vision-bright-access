#!/usr/bin/env bash
# Host firewall for the ISP stack. Prints the ufw commands by default; applies
# them only with --apply. It never opens a database, RADIUS, Redis or debug port.
#
# Hetzner Cloud Firewall (set in the console, in front of the host) should carry the
# same rules: inbound TCP 22 (restricted to your admin IPs), 80, 443; everything else dropped.
set -euo pipefail
ADMIN_SSH_SOURCES="${ADMIN_SSH_SOURCES:?set ADMIN_SSH_SOURCES to a space-separated list of admin IPs/CIDRs}"
cmds=(
  "ufw default deny incoming"
  "ufw default allow outgoing"
  "ufw allow 80/tcp"
  "ufw allow 443/tcp"
)
for src in $ADMIN_SSH_SOURCES; do cmds+=("ufw allow from $src to any port 22 proto tcp"); done
# 5432 (PostgreSQL) and 8443 (API) are bound to the internal network / loopback and are NOT opened.
if [ "${1:-}" = "--apply" ]; then
  for c in "${cmds[@]}"; do echo "+ $c"; $c; done
  ufw --force enable
else
  printf '%s\n' "${cmds[@]}" "ufw --force enable"
  echo "(dry run: pass --apply to execute)"
fi
