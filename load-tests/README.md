# VisionKids Load Tests (k6)

Runnable [k6](https://k6.io) scripts for the Phase 19/20 scalability spec
(items: 100 → 1,000,000 concurrent users). **These are scripts, not results.**
Nobody has run them against live infra from this repo yet — run them yourself
against a **staging** target and record the numbers in the results table below.

> ⚠️ Never point these at production, and never at a database with real
> children's data. Use an isolated staging project with seeded fixtures.

## Prerequisites

```bash
# macOS: brew install k6   |   Windows: winget install k6   |   Linux: see k6.io/docs
k6 version
```

## Run

```bash
BASE_URL=https://staging.visionex.app k6 run load-tests/browse.js
```

Scenarios ramp virtual users (VUs). k6 VUs are concurrent iterations, not a 1:1
map to "users" — 10k+ real concurrent users needs distributed execution
(k6 Cloud or multiple load generators). The 100k / 1M rows below are
**capacity-planning targets**, reached with distributed runners, not a laptop.

| Target users | How to run | Status |
|---|---|---|
| 100 | single runner, `browse.js` | ☐ not yet run |
| 1,000 | single runner, raise `--vus`/`--stage` | ☐ not yet run |
| 10,000 | k6 Cloud or 2–4 runners | ☐ not yet run |
| 100,000 | distributed (k6 Cloud) | ☐ not yet run |
| 1,000,000 | distributed + CDN cache validation | ☐ not yet run |

## What to record

For each run: p95/p99 latency, error rate, throughput (req/s), and the first
**bottleneck** observed (DB connections, edge-function cold starts, storage
egress, CDN hit ratio). Put findings in the Phase 19 DR/scaling docs.
