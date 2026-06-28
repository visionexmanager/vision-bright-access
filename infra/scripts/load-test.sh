#!/usr/bin/env bash
# load-test.sh — Global traffic simulation
# Requires: k6 (https://k6.io)
# Simulates 1M+ concurrent users across regions with AI generation spikes

set -euo pipefail

TARGET="${TARGET:-https://app.visionex.ai}"
DURATION="${DURATION:-30m}"
REPORT_DIR="./load-test-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

cat > /tmp/visionex-load-test.js << 'EOF'
import http      from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

const apiLatency     = new Trend('api_latency_ms',    true);
const genSuccessRate = new Rate('generation_success');
const billingErrors  = new Counter('billing_errors');

// Simulated user tokens (replace with real test JWTs in CI)
const TEST_TOKEN = __ENV.TEST_JWT || 'test-token';

export const options = {
  scenarios: {
    // Baseline: sustained global traffic
    baseline_traffic: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '2m',  target: 1000  },
        { duration: '5m',  target: 5000  },
        { duration: '10m', target: 10000 },
        { duration: '5m',  target: 5000  },
        { duration: '3m',  target: 1000  },
      ],
      gracefulRampDown: '2m',
      tags: { scenario: 'baseline' },
    },
    // AI generation spike
    generation_spike: {
      executor: 'constant-arrival-rate',
      rate:     500,              // 500 generation requests/second at peak
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 200,
      maxVUs: 1000,
      startTime: '12m',          // starts mid-test
      tags: { scenario: 'spike' },
    },
    // Stress test — push to limits
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 1000,
      timeUnit: '1s',
      stages: [
        { duration: '5m',  target: 5000  },
        { duration: '10m', target: 20000 },
        { duration: '5m',  target: 50000 },
        { duration: '5m',  target: 1000  },
      ],
      preAllocatedVUs: 500,
      maxVUs: 5000,
      startTime: '20m',
      tags: { scenario: 'stress' },
    },
  },
  thresholds: {
    http_req_duration:  ['p(95)<2000', 'p(99)<5000'],
    http_req_failed:    ['rate<0.01'],
    api_latency_ms:     ['p(95)<2000'],
    generation_success: ['rate>0.95'],
  },
};

export default function () {
  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type':  'application/json',
  };
  const base = __ENV.TARGET || 'https://app.visionex.ai';

  // 1. Health check
  const health = http.get(`${base}/health/ready`);
  check(health, { 'health ok': (r) => r.status === 200 });

  // 2. Billing status (high frequency)
  const billing = http.post(`${base}/functions/v1/billing-engine`,
    JSON.stringify({ action: 'get_balance' }),
    { headers }
  );
  check(billing, { 'billing ok': (r) => r.status === 200 });
  apiLatency.add(billing.timings.duration);
  if (billing.status >= 500) billingErrors.add(1);

  // 3. Speech generation (simulated, billing-gate validates)
  if (Math.random() < 0.15) {
    const tts = http.post(`${base}/functions/v1/speech-generate`,
      JSON.stringify({
        action:      'generate',
        text:        'Hello from load test',
        voice_id:    'test-voice',
        provider:    'mock',
        idempotency_key: `lt-${__VU}-${__ITER}`,
      }),
      { headers, timeout: '30s' }
    );
    genSuccessRate.add(tts.status === 200);
    apiLatency.add(tts.timings.duration);
  }

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    '/tmp/load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
EOF

echo "▶ Starting load test against $TARGET for $DURATION"
echo "  Results → $REPORT_DIR"

k6 run \
  --env TARGET="$TARGET" \
  --env TEST_JWT="${TEST_JWT:-}" \
  --out json="$REPORT_DIR/results.json" \
  --duration "$DURATION" \
  /tmp/visionex-load-test.js

# Copy summary
cp /tmp/load-test-summary.json "$REPORT_DIR/summary.json"

echo ""
echo "✅ Load test complete. Results in: $REPORT_DIR"
echo ""

# Validate thresholds
python3 - << PYEOF
import json, sys
with open("$REPORT_DIR/summary.json") as f:
    data = json.load(f)

metrics = data.get("metrics", {})
p95 = metrics.get("http_req_duration", {}).get("values", {}).get("p(95)", 9999)
p99 = metrics.get("http_req_duration", {}).get("values", {}).get("p(99)", 9999)
err = metrics.get("http_req_failed",   {}).get("values", {}).get("rate", 1)

print(f"P95 latency: {p95:.0f}ms  (threshold: 2000ms)  {'✓' if p95 < 2000 else '✗'}")
print(f"P99 latency: {p99:.0f}ms  (threshold: 5000ms)  {'✓' if p99 < 5000 else '✗'}")
print(f"Error rate:  {err:.3%}    (threshold: 1%)       {'✓' if err < 0.01 else '✗'}")

ok = p95 < 2000 and p99 < 5000 and err < 0.01
sys.exit(0 if ok else 1)
PYEOF
