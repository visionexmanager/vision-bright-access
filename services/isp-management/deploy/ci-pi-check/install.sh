#!/bin/bash
# Installs the CI-only, read-only PI-check access path. Run by a human administrator,
# as root, on the server, from a checkout of the approved commit of main:
#
#   sudo ./install.sh --pubkey-file /path/to/isp-pi-check.pub            # DRY RUN: prints, changes nothing
#   sudo ./install.sh --pubkey-file /path/to/isp-pi-check.pub --apply
#
# It ADDS an isolated account. It does not edit sshd_config, any existing user, any
# existing authorized_keys, sudoers.conf, the firewall, Docker, nginx, or any
# VisionEX / Supabase / PI / RADIUS setting. The uninstall.sh next to it removes
# everything this script creates.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
APPLY=0; PUBKEY_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --pubkey-file) PUBKEY_FILE="${2:-}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
[ "$(id -u)" -eq 0 ] || { echo "run as root" >&2; exit 1; }
[ -n "$PUBKEY_FILE" ] && [ -f "$PUBKEY_FILE" ] || { echo "--pubkey-file <public key file> is required" >&2; exit 2; }

say() { printf '%s\n' "$*"; }
run() { if [ "$APPLY" = 1 ]; then say "+ $*"; "$@"; else say "[dry-run] $*"; fi; }

# ---- 1. validate the public key (never accept a private key or a key with options) ----
key="$(tr -d '\r' < "$PUBKEY_FILE")"
[ "$(printf '%s\n' "$key" | grep -c .)" = 1 ] || { echo "the key file must hold exactly one line" >&2; exit 2; }
printf '%s' "$key" | grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,2}( [A-Za-z0-9._@-]+)?$' || { echo "not a plain ssh-ed25519 PUBLIC key" >&2; exit 2; }
keyblob="$(printf '%s' "$key" | awk '{print $1" "$2}')"

# ---- 2. preconditions ----
for f in /usr/bin/node /usr/bin/sudo /usr/bin/flock /usr/bin/sha256sum /usr/sbin/visudo /usr/sbin/useradd /usr/sbin/usermod; do
  [ -x "$f" ] || { echo "missing $f" >&2; exit 1; }
done
want="$(grep -E '^EXPECTED_SHA256=' "$here/isp-pi-check-run" | cut -d= -f2)"
have="$(tr -d '\r' < "$here/pi-check.mjs" | sha256sum | cut -d' ' -f1)"
[ "$want" = "$have" ] || { echo "pi-check.mjs does not match the hash pinned in isp-pi-check-run (stale checkout?)" >&2; exit 1; }
say "bundle hash matches the pin"

# ---- 3. the isolated account: no shell login, no password, no extra groups ----
if id isp-ci >/dev/null 2>&1; then
  [ "$(id -nG isp-ci)" = "isp-ci" ] || { echo "isp-ci exists and is in other groups; refusing" >&2; exit 1; }
  say "user isp-ci already exists (single group): ok"
else
  run /usr/sbin/useradd --system --user-group --home-dir /var/lib/isp-ci --no-create-home --shell /bin/sh --comment "CI read-only PI check" isp-ci
  # '*' = no password can ever match, yet public-key login stays possible (unlike '!').
  run /usr/sbin/usermod -p '*' isp-ci
fi

# ---- 4. root-owned home and key file: the account cannot change its own access ----
run install -d -o root -g root -m 0755 /var/lib/isp-ci /var/lib/isp-ci/.ssh
tmpkeys="$(mktemp)"; trap 'rm -f "$tmpkeys" "${tmpsudo:-}"' EXIT
sed "s#ssh-ed25519 REPLACE_WITH_THE_PUBLIC_KEY isp-pi-check-ci#${keyblob} isp-pi-check-ci#" "$here/authorized_keys.template" > "$tmpkeys"
grep -q REPLACE_WITH "$tmpkeys" && { echo "key substitution failed" >&2; exit 1; }
run install -o root -g root -m 0644 "$tmpkeys" /var/lib/isp-ci/.ssh/authorized_keys

# ---- 5. the program, the bundle, the entry point ----
run install -d -o root -g root -m 0755 /usr/local/lib/isp-pi-check
run install -o root -g root -m 0644 "$here/pi-check.mjs" /usr/local/lib/isp-pi-check/pi-check.mjs
run install -o root -g root -m 0755 "$here/isp-pi-check-run" /usr/local/sbin/isp-pi-check-run
run install -o root -g root -m 0755 "$here/isp-pi-check-entry" /usr/local/sbin/isp-pi-check-entry

# ---- 6. sudoers: validated BEFORE it is installed ----
tmpsudo="$(mktemp)"; cp "$here/sudoers.isp-pi-check" "$tmpsudo"
/usr/sbin/visudo -cf "$tmpsudo" >/dev/null || { echo "sudoers rule failed validation; nothing installed" >&2; exit 1; }
run install -o root -g root -m 0440 "$tmpsudo" /etc/sudoers.d/isp-pi-check

if [ "$APPLY" = 1 ]; then
  say "--- verification (read-only) ---"
  /usr/sbin/visudo -c >/dev/null && say "sudoers: valid"
  n="$(sudo -l -U isp-ci 2>/dev/null | grep -c 'isp-pi-check-run')" ; say "sudo grants mentioning the check program: $n (expect 2 lines: check, probe)"
  # The entry point must refuse anything but the two words.
  if sudo -u isp-ci env -i SSH_ORIGINAL_COMMAND='id; cat /etc/shadow' /usr/local/sbin/isp-pi-check-entry >/dev/null 2>&1; then
    echo "FAIL: entry point accepted an arbitrary command" >&2; exit 1
  else say "entry point refuses arbitrary commands: ok"; fi
  say "installed. Next: put the PRIVATE key in the GitHub secret ISP_PI_CHECK_SSH_KEY and delete it locally."
else
  say "(dry run: re-run with --apply to make these changes)"
fi
