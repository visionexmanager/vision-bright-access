#!/usr/bin/env bash
# deploy.sh — One-command deploy to a single region or all regions
# Usage:
#   ./infra/scripts/deploy.sh --region europe --tag abc1234
#   ./infra/scripts/deploy.sh --all --tag abc1234
#   ./infra/scripts/deploy.sh --rollback --region europe

set -euo pipefail

###############################################################################
# Config
###############################################################################
PROJECT_ID="${GCP_PROJECT_ID:-visionex-prod}"
NAMESPACE="visionex-ams"
CHART_PATH="./infra/helm/visionex-ams"
VALUES_FILE="$CHART_PATH/values-production.yaml"

declare -A CLUSTERS=(
  [europe]="visionex-eu:europe-west1"
  [middle_east]="visionex-me:me-central1"
  [us_east]="visionex-use:us-east1"
  [us_west]="visionex-usw:us-west1"
  [asia]="visionex-asia:asia-east1"
)

REGION=""
TAG="latest"
ALL=false
ROLLBACK=false

###############################################################################
# Argument parsing
###############################################################################
while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)   REGION="$2"; shift 2 ;;
    --tag)      TAG="$2"; shift 2 ;;
    --all)      ALL=true; shift ;;
    --rollback) ROLLBACK=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

###############################################################################
# Functions
###############################################################################
get_credentials() {
  local cluster_info="${CLUSTERS[$1]}"
  local cluster="${cluster_info%%:*}"
  local region="${cluster_info##*:}"
  echo "→ Getting credentials for $cluster in $region"
  gcloud container clusters get-credentials "$cluster" \
    --region "$region" --project "$PROJECT_ID" --quiet
}

deploy_region() {
  local region="$1"
  get_credentials "$region"
  if $ROLLBACK; then
    echo "→ Rolling back in $region"
    helm rollback visionex-ams 0 --namespace "$NAMESPACE" --wait --timeout=10m
    echo "✓ Rollback complete in $region"
  else
    echo "→ Deploying tag=$TAG to $region"
    helm upgrade --install visionex-ams "$CHART_PATH" \
      --namespace "$NAMESPACE" \
      --create-namespace \
      --set image.tag="$TAG" \
      --set environment=production \
      --values "$VALUES_FILE" \
      --atomic \
      --timeout 15m \
      --history-max 5
    echo "✓ Deployed to $region (tag=$TAG)"
    health_check "$region"
  fi
}

health_check() {
  local region="$1"
  echo "→ Health checking $region..."
  local pod
  pod=$(kubectl get pods -n "$NAMESPACE" \
    -l app=api-gateway --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [[ -z "$pod" ]]; then
    echo "✗ No running api-gateway pods found in $region"
    exit 1
  fi
  kubectl wait "pod/$pod" -n "$NAMESPACE" --for=condition=Ready --timeout=300s
  echo "✓ Health check passed in $region"
}

###############################################################################
# Execute
###############################################################################
if $ALL; then
  echo "▶ Deploying to ALL regions (tag=$TAG)"
  PIDS=()
  for region in "${!CLUSTERS[@]}"; do
    deploy_region "$region" &
    PIDS+=($!)
  done
  # Wait for all and collect exit codes
  FAILED=0
  for pid in "${PIDS[@]}"; do
    if ! wait "$pid"; then
      echo "✗ A region deployment failed (PID $pid)"
      FAILED=$((FAILED+1))
    fi
  done
  if [ $FAILED -gt 0 ]; then
    echo "✗ $FAILED region(s) failed. Check logs above."
    exit 1
  fi
  echo "✅ All regions deployed successfully (tag=$TAG)"
elif [[ -n "$REGION" ]]; then
  if [[ -z "${CLUSTERS[$REGION]+_}" ]]; then
    echo "Unknown region: $REGION. Valid: ${!CLUSTERS[*]}"
    exit 1
  fi
  deploy_region "$REGION"
else
  echo "Specify --region <name> or --all"
  exit 1
fi
