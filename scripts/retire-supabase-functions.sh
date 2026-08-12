#!/usr/bin/env bash
#
# Retire Supabase Edge Functions listed in supabase/retirement-manifest.json.
#
# This is the counterpart to scripts/deploy-changed-supabase-functions.sh, which
# only ever creates and updates. Nothing in this repository used to remove a
# function, so production could hold functions that no longer had source. Ten
# career-ai-* functions did exactly that, filling the project's function cap and
# blocking their own replacement from deploying.
#
# The rule this script exists to enforce: absence from the repository NEVER
# authorizes a deletion. A function is deleted only when it is named in the
# manifest, which is a reviewed file in a pull request. Anything deployed that
# is in neither the repository nor the manifest is reported as drift and left
# completely alone.
#
# Modes:
#   MODE=plan  (default) — reconcile and print. Touches nothing.
#   MODE=apply           — delete, and only with CONFIRM set to the exact phrase.
#
# Required environment:
#   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
#   CONFIRM=RETIRE-PRODUCTION-FUNCTIONS   (apply mode only)

set -euo pipefail

readonly FUNCTIONS_DIR="supabase/functions"
readonly MANIFEST="supabase/retirement-manifest.json"
readonly API="https://api.supabase.com/v1"
readonly CONFIRM_PHRASE="RETIRE-PRODUCTION-FUNCTIONS"

MODE="${MODE:-plan}"

# Functions that may never be deleted by this script no matter what any file
# says. Duplicating the manifest's never_retire list here is deliberate: the
# manifest is data and could be edited in the same pull request that adds a
# retirement, so the last word lives in the script. Every payment webhook, every
# unauthenticated endpoint, and both halves of the owner-approval path are here
# because deleting one silently drops deliveries rather than erroring.
readonly HARD_PROTECTED=(
  ai-search
  bazaar-stripe-webhook
  career-ai
  career-billing-webhook
  contact-form
  health-check
  library-crypto-webhook
  library-paypal-webhook
  library-process-background-jobs
  library-stripe-webhook
  owner-control
  trial-billing
  tv-stream-token
  tv-validate-stream
  whatsapp-webhook
)

die() { echo "::error::$*" >&2; exit 1; }

note() { echo "$*"; }

# Everything this script prints also goes to the workflow summary, so a
# retirement leaves a permanent record on the run rather than only in logs.
log_line() {
  echo "$*"
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "$*" >>"$GITHUB_STEP_SUMMARY"
  fi
}

is_protected() {
  local slug="$1"
  for protected in "${HARD_PROTECTED[@]}"; do
    [[ "$slug" == "$protected" ]] && return 0
  done
  return 1
}

# ── Preconditions ────────────────────────────────────────────────────────────

command -v jq >/dev/null || die "jq is required."
[[ -f "$MANIFEST" ]] || die "Manifest $MANIFEST not found. Run from the repository root."
[[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]] || die "SUPABASE_ACCESS_TOKEN is not set."
[[ -n "${SUPABASE_PROJECT_REF:-}" ]] || die "SUPABASE_PROJECT_REF is not set."

case "$MODE" in
  plan|apply) ;;
  *) die "MODE must be 'plan' or 'apply', got '$MODE'." ;;
esac

jq empty "$MANIFEST" 2>/dev/null || die "$MANIFEST is not valid JSON."

# ── Read the three sources of truth ──────────────────────────────────────────

mapfile -t repo_functions < <(
  find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '_shared' -printf '%f\n' | sort
)

mapfile -t manifest_slugs < <(jq -r '.retire[].slug' "$MANIFEST" | sort)

# The deployed list comes from the Management API rather than a CLI table, so
# the reconciliation reads a machine-readable answer instead of parsed output.
response="$(mktemp)"
trap 'rm -f "$response"' EXIT

http_code="$(
  curl -sS --max-time 60 -o "$response" -w '%{http_code}' \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "$API/projects/$SUPABASE_PROJECT_REF/functions"
)"

[[ "$http_code" == "200" ]] || die "Listing functions failed with HTTP $http_code."

mapfile -t deployed_functions < <(jq -r '.[].slug' "$response" | sort)

(( ${#deployed_functions[@]} > 0 )) || die "The project reports zero deployed functions; refusing to act on that."

# ── Validate the manifest before computing anything ──────────────────────────
#
# These are contradictions, not conditions to work around. A slug that is both
# shipped by the repository and marked for retirement means someone got one of
# the two wrong, and guessing which would be the dangerous move.

for slug in "${manifest_slugs[@]:-}"; do
  [[ -n "$slug" ]] || continue

  if [[ -d "$FUNCTIONS_DIR/$slug" ]]; then
    die "Manifest lists '$slug' for retirement but $FUNCTIONS_DIR/$slug still exists. Remove the source first, or remove the manifest entry."
  fi

  if is_protected "$slug"; then
    die "Manifest lists protected function '$slug'. Protected functions cannot be retired by this script."
  fi
done

# ── Reconcile ────────────────────────────────────────────────────────────────

to_delete=()
already_gone=()

for slug in "${manifest_slugs[@]:-}"; do
  [[ -n "$slug" ]] || continue
  if printf '%s\n' "${deployed_functions[@]}" | grep -qxF "$slug"; then
    to_delete+=("$slug")
  else
    already_gone+=("$slug")
  fi
done

# Deployed, but in neither the repository nor the manifest. This is the case the
# script must never act on by itself: it is exactly the shape of the career-ai-*
# orphans, and also the shape of a function someone deployed by hand on purpose.
drift=()
for slug in "${deployed_functions[@]}"; do
  if printf '%s\n' "${repo_functions[@]}" | grep -qxF "$slug"; then continue; fi
  if printf '%s\n' "${manifest_slugs[@]:-}" | grep -qxF "$slug"; then continue; fi
  drift+=("$slug")
done

# In the repository but not deployed. Not this script's job to fix — that is the
# deploy script — but staying silent about it is how the cap problem hid.
undeployed=()
for slug in "${repo_functions[@]}"; do
  printf '%s\n' "${deployed_functions[@]}" | grep -qxF "$slug" || undeployed+=("$slug")
done

# ── Report ───────────────────────────────────────────────────────────────────

log_line "## Supabase Edge Function reconciliation"
log_line ""
log_line "- Mode: \`$MODE\`"
log_line "- Deployed in production: ${#deployed_functions[@]}"
log_line "- Present in repository: ${#repo_functions[@]}"
log_line "- Named in retirement manifest: ${#manifest_slugs[@]}"
log_line ""

log_line "### Will be deleted (${#to_delete[@]})"
if (( ${#to_delete[@]} == 0 )); then
  log_line "_Nothing. The manifest is fully reconciled._"
else
  for slug in "${to_delete[@]}"; do
    replaced_by="$(jq -r --arg s "$slug" '.retire[] | select(.slug == $s) | .replaced_by' "$MANIFEST")"
    log_line "- \`$slug\` → replaced by $replaced_by"
  done
fi
log_line ""

if (( ${#already_gone[@]} > 0 )); then
  log_line "### Already retired (${#already_gone[@]})"
  for slug in "${already_gone[@]}"; do log_line "- \`$slug\`"; done
  log_line ""
fi

if (( ${#drift[@]} > 0 )); then
  log_line "### Unrecognised — reported only, never deleted (${#drift[@]})"
  log_line ""
  log_line "Deployed but in neither the repository nor the manifest. Add an entry to"
  log_line "\`$MANIFEST\` in a reviewed pull request if one of these should go."
  for slug in "${drift[@]}"; do log_line "- \`$slug\`"; done
  log_line ""
fi

if (( ${#undeployed[@]} > 0 )); then
  log_line "### In the repository but not deployed (${#undeployed[@]})"
  for slug in "${undeployed[@]}"; do log_line "- \`$slug\`"; done
  log_line ""
fi

if [[ "$MODE" == "plan" ]]; then
  log_line "Plan only — nothing was changed."
  exit 0
fi

# ── Apply ────────────────────────────────────────────────────────────────────

[[ "${CONFIRM:-}" == "$CONFIRM_PHRASE" ]] ||
  die "Apply mode requires CONFIRM=$CONFIRM_PHRASE. Nothing was deleted."

if (( ${#to_delete[@]} == 0 )); then
  log_line "Nothing to delete."
  exit 0
fi

log_line "### Deletion log"
failures=0

for slug in "${to_delete[@]}"; do
  # Re-check both guards immediately before the destructive call. The lists were
  # validated above, but this is the last line before an irreversible request.
  if is_protected "$slug" || [[ -d "$FUNCTIONS_DIR/$slug" ]]; then
    die "Refusing to delete '$slug' at apply time — protected or present in the repository."
  fi

  code="$(
    curl -sS --max-time 60 -o /dev/null -w '%{http_code}' -X DELETE \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
      "$API/projects/$SUPABASE_PROJECT_REF/functions/$slug"
  )"

  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  case "$code" in
    200|204)
      log_line "- \`$slug\` deleted — HTTP $code — $timestamp" ;;
    404)
      log_line "- \`$slug\` already absent — HTTP 404 — $timestamp" ;;
    *)
      log_line "- \`$slug\` **FAILED** — HTTP $code — $timestamp"
      failures=$(( failures + 1 )) ;;
  esac
done

log_line ""

# Re-list so the reported count is production's answer, not our arithmetic.
http_code="$(
  curl -sS --max-time 60 -o "$response" -w '%{http_code}' \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "$API/projects/$SUPABASE_PROJECT_REF/functions"
)"

if [[ "$http_code" == "200" ]]; then
  log_line "Deployed functions after retirement: $(jq -r 'length' "$response")"
else
  log_line "Could not re-list functions to confirm the count (HTTP $http_code)."
fi

(( failures == 0 )) || die "$failures function(s) failed to delete."
