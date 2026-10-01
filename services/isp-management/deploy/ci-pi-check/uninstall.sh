#!/bin/bash
# Removes exactly what install.sh created, nothing else. Dry run unless --apply.
#   sudo ./uninstall.sh [--apply]
set -euo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
run() { if [ "$APPLY" = 1 ]; then echo "+ $*"; "$@"; else echo "[dry-run] $*"; fi; }

# Access first: with the key and sudo rule gone, nothing else matters.
run rm -f /var/lib/isp-ci/.ssh/authorized_keys /etc/sudoers.d/isp-pi-check
run rm -f /usr/local/sbin/isp-pi-check-entry /usr/local/sbin/isp-pi-check-run
run rm -f /usr/local/lib/isp-pi-check/pi-check.mjs
run rmdir /usr/local/lib/isp-pi-check /var/lib/isp-ci/.ssh /var/lib/isp-ci
id isp-ci >/dev/null 2>&1 && run /usr/sbin/userdel isp-ci
[ "$APPLY" = 1 ] || echo "(dry run: pass --apply)"
