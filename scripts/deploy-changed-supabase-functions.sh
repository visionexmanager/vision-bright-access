#!/usr/bin/env bash

set -euo pipefail

readonly FUNCTIONS_DIR="supabase/functions"
readonly MAX_ATTEMPTS=4

declare -A NO_VERIFY_JWT=(
  [health-check]=1
  [library-crypto-webhook]=1
  [library-paypal-webhook]=1
  [library-process-background-jobs]=1
  [library-stripe-webhook]=1
  [news-generate]=1
  [trial-billing]=1
  [tv-stream-token]=1
  [tv-validate-stream]=1
)

list_all_functions() {
  find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d \
    ! -name '_shared' -printf '%f\n' | sort
}

list_changed_functions() {
  local before_sha="${GITHUB_EVENT_BEFORE:-}"

  if [[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]] ||
     [[ -z "$before_sha" ]] ||
     [[ "$before_sha" =~ ^0+$ ]]; then
    list_all_functions
    return
  fi

  git fetch --no-tags --depth=1 origin "$before_sha"

  local changed_files
  changed_files="$(git diff --name-only "$before_sha" "${GITHUB_SHA}" -- "$FUNCTIONS_DIR")"

  if grep -q "^${FUNCTIONS_DIR}/_shared/" <<<"$changed_files"; then
    list_all_functions
    return
  fi

  awk -F/ -v root="$FUNCTIONS_DIR" \
    '$1 "/" $2 == root && $3 != "" && $3 != "_shared" { print $3 }' \
    <<<"$changed_files" | sort -u
}

deploy_function() {
  local function_name="$1"
  local -a args=(
    functions deploy "$function_name"
    --project-ref "$SUPABASE_PROJECT_REF"
  )

  if [[ -n "${NO_VERIFY_JWT[$function_name]:-}" ]]; then
    args+=(--no-verify-jwt)
  fi

  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
    echo "Deploying ${function_name} (attempt ${attempt}/${MAX_ATTEMPTS})..."

    if supabase "${args[@]}"; then
      return 0
    fi

    if (( attempt == MAX_ATTEMPTS )); then
      echo "::error::Failed to deploy ${function_name} after ${MAX_ATTEMPTS} attempts."
      return 1
    fi

    local wait_seconds=$((attempt * 15))
    echo "Deployment failed; retrying in ${wait_seconds} seconds."
    sleep "$wait_seconds"
  done
}

mapfile -t functions < <(list_changed_functions)

if (( ${#functions[@]} == 0 )); then
  echo "No Supabase Edge Function changes detected; nothing to deploy."
  exit 0
fi

printf 'Functions selected for deployment:\n'
printf ' - %s\n' "${functions[@]}"

for function_name in "${functions[@]}"; do
  deploy_function "$function_name"
done
