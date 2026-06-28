#!/usr/bin/env bash
# Visionex TV — Emergency Rollback
# Usage: ./scripts/rollback.sh [deployment-name]
set -euo pipefail
NAMESPACE="visionex-tv"
TARGET="${1:-all}"

rollback_one() {
  local name=$1
  echo "Rolling back $name..."
  kubectl rollout undo deployment/$name -n $NAMESPACE
  kubectl rollout status deployment/$name -n $NAMESPACE --timeout=120s
  echo "$name rolled back ✓"
}

if [[ "$TARGET" == "all" ]]; then
  rollback_one visionex-tv-backend
  rollback_one visionex-stream-proxy
  rollback_one visionex-frontend
else
  rollback_one "$TARGET"
fi

echo ""
echo "Rollback complete. Current pod status:"
kubectl get pods -n $NAMESPACE
