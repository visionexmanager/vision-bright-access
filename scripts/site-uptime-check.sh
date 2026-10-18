#!/usr/bin/env bash
# Public availability check for the production site. Read-only: anonymous GETs of
# public files, no credentials, nothing from a response body is printed (this
# repository is public and its logs are world-readable).
#
# Fails (exit 1) when:
#   - the home page is not HTTP 200 HTML containing the SPA root,
#   - the main JavaScript bundle named by that page is not served as JavaScript
#     (a missing asset on this site returns index.html with a 200, so the status
#     code alone proves nothing),
#   - the TLS certificate expires in fewer than MIN_CERT_DAYS days.
#
# Usage: SITE=https://visionex.app MIN_CERT_DAYS=14 scripts/site-uptime-check.sh
set -uo pipefail

SITE="${SITE:-https://visionex.app}"
MIN_CERT_DAYS="${MIN_CERT_DAYS:-14}"
host="${SITE#https://}"; host="${host%%/*}"
fail=0
say() { echo "$*"; [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$*" >>"$GITHUB_STEP_SUMMARY"; return 0; }
bad() { say "FAIL: $*"; fail=1; }

tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT

code="$(curl -sS -L --max-time 20 --retry 2 --retry-delay 3 -o "$tmp" -w '%{http_code} %{content_type}' "$SITE/" || echo "000 curl-error")"
status="${code%% *}"; ctype="${code#* }"
if [ "$status" != "200" ]; then bad "home page returned HTTP $status"
elif ! echo "$ctype" | grep -qi 'text/html'; then bad "home page content-type is '$ctype'"
elif ! grep -q 'id="root"' "$tmp"; then bad "home page has no SPA root element"
else say "ok: home page 200 text/html with SPA root"; fi

bundle="$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' "$tmp" | head -n1 || true)"
if [ -z "$bundle" ]; then
  bad "no main bundle referenced by the home page"
else
  bcode="$(curl -sS --max-time 30 --retry 2 --retry-delay 3 -o /dev/null -w '%{http_code} %{content_type}' "$SITE$bundle" || echo "000 curl-error")"
  bstatus="${bcode%% *}"; bctype="${bcode#* }"
  if [ "$bstatus" = "200" ] && echo "$bctype" | grep -Eqi 'javascript'; then say "ok: main bundle served as JavaScript"
  else bad "main bundle returned HTTP $bstatus with content-type '$bctype'"; fi
fi

enddate="$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
if [ -z "$enddate" ]; then bad "could not read the TLS certificate"
else
  end_epoch="$(date -d "$enddate" +%s 2>/dev/null || date -j -f '%b %e %T %Y %Z' "$enddate" +%s 2>/dev/null || echo 0)"
  days=$(( (end_epoch - $(date +%s)) / 86400 ))
  if [ "$end_epoch" = "0" ]; then bad "could not parse the certificate expiry"
  elif [ "$days" -lt "$MIN_CERT_DAYS" ]; then bad "TLS certificate expires in $days days (minimum $MIN_CERT_DAYS)"
  else say "ok: TLS certificate valid for $days more days"; fi
fi

exit "$fail"
