#!/usr/bin/env bash
# Visionex TV — Production Deploy Script
# Usage: ./scripts/deploy.sh [staging|production] [image-tag]
set -euo pipefail

ENVIRONMENT="${1:-production}"
IMAGE_TAG="${2:-latest}"
NAMESPACE="visionex-tv"
IMAGE_BASE="ghcr.io/visionexmanager"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail() { echo -e "${RED}[fail]${NC}  $*"; exit 1; }

# ── Validate ──────────────────────────────────────────────────────────────────
[[ "$ENVIRONMENT" =~ ^(staging|production)$ ]] || fail "Unknown environment: $ENVIRONMENT"
command -v kubectl >/dev/null 2>&1 || fail "kubectl not found"
command -v helm    >/dev/null 2>&1 || warn  "helm not found (optional)"

log "Deploying Visionex TV to $ENVIRONMENT (tag: $IMAGE_TAG)"

# ── Namespace + secrets ───────────────────────────────────────────────────────
kubectl apply -f k8s/namespaces.yaml
log "Namespaces OK"

if ! kubectl get secret visionex-tv-secrets -n $NAMESPACE &>/dev/null; then
  fail "Secret 'visionex-tv-secrets' not found in namespace $NAMESPACE. Create it first."
fi

# ── ConfigMaps ────────────────────────────────────────────────────────────────
kubectl apply -f k8s/backend/configmap.yaml -n $NAMESPACE
log "ConfigMaps OK"

# ── Database (only on first deploy) ──────────────────────────────────────────
if ! kubectl get statefulset postgres -n $NAMESPACE &>/dev/null; then
  log "First deploy — creating database..."
  kubectl apply -f k8s/database/postgres.yaml -n $NAMESPACE
  kubectl apply -f k8s/database/redis.yaml    -n $NAMESPACE
  log "Waiting for postgres to be ready..."
  kubectl rollout status statefulset/postgres -n $NAMESPACE --timeout=120s
else
  log "Database already running — skipping"
fi

# ── Backend ───────────────────────────────────────────────────────────────────
log "Deploying backend..."
kubectl set image deployment/visionex-tv-backend \
  backend="${IMAGE_BASE}/visionex-tv-backend:${IMAGE_TAG}" \
  -n $NAMESPACE 2>/dev/null || \
  kubectl apply -f k8s/backend/deployment.yaml -n $NAMESPACE
kubectl apply -f k8s/backend/configmap.yaml -n $NAMESPACE
kubectl rollout status deployment/visionex-tv-backend -n $NAMESPACE --timeout=300s
log "Backend ✓"

# ── Stream Proxy ──────────────────────────────────────────────────────────────
log "Deploying stream proxy..."
kubectl set image deployment/visionex-stream-proxy \
  stream-proxy="${IMAGE_BASE}/visionex-tv-stream-proxy:${IMAGE_TAG}" \
  -n $NAMESPACE 2>/dev/null || \
  kubectl apply -f k8s/streaming/deployment.yaml -n $NAMESPACE
kubectl rollout status deployment/visionex-stream-proxy -n $NAMESPACE --timeout=300s
log "Stream proxy ✓"

# ── Frontend ──────────────────────────────────────────────────────────────────
log "Deploying frontend..."
kubectl set image deployment/visionex-frontend \
  frontend="${IMAGE_BASE}/visionex-tv-frontend:${IMAGE_TAG}" \
  -n $NAMESPACE 2>/dev/null || \
  kubectl apply -f k8s/frontend/deployment.yaml -n $NAMESPACE
kubectl rollout status deployment/visionex-frontend -n $NAMESPACE --timeout=300s
log "Frontend ✓"

# ── Ingress ───────────────────────────────────────────────────────────────────
kubectl apply -f k8s/ingress/ingress.yaml -n $NAMESPACE
log "Ingress ✓"

# ── Monitoring ────────────────────────────────────────────────────────────────
kubectl apply -f k8s/monitoring/prometheus.yaml
kubectl apply -f k8s/monitoring/grafana.yaml
kubectl apply -f k8s/monitoring/loki.yaml
log "Monitoring ✓"

# ── Smoke test ────────────────────────────────────────────────────────────────
log "Running smoke tests..."
sleep 10
BACKEND_SVC=$(kubectl get svc visionex-tv-backend -n $NAMESPACE -o jsonpath='{.spec.clusterIP}')
HEALTH=$(kubectl exec -n $NAMESPACE \
  "$(kubectl get pod -n $NAMESPACE -l app=visionex-tv-backend -o jsonpath='{.items[0].metadata.name}')" \
  -- wget -qO- http://localhost:3000/health 2>/dev/null || echo "{}")
echo "Health response: $HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "Smoke test ✓"
else
  warn "Health check returned unexpected response — check backend logs"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════════"
log " Visionex TV deployed successfully!"
log " Environment:  $ENVIRONMENT"
log " Image tag:    $IMAGE_TAG"
log " Namespace:    $NAMESPACE"
log ""
kubectl get pods -n $NAMESPACE -o wide
log "═══════════════════════════════════════════════"
