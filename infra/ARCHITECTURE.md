# Visionex AI Media Studio — Global Production Architecture

## Overview

Multi-region, multi-cloud SaaS platform engineered for 1M+ concurrent users,
zero-downtime deployments, and enterprise-grade security.

---

## 5-Region Topology

```
                        ┌─────────────────────────────────────────────────┐
                        │          Global Load Balancer (GCP GLB)          │
                        │  Cloud Armor WAF · DDoS Protection · Cloud CDN   │
                        │      Geo-routing · Latency-routing · Failover    │
                        └────┬──────┬──────┬──────┬──────────────────────┘
                             │      │      │      │
              ┌──────────────┘      │      │      └───────────────────┐
              │          ┌──────────┘      └──────────┐               │
              ▼          ▼                             ▼               ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ EU-W1    │ │ ME-C1    │ │ US-E1    │ │ US-W1    │ │ AS-E1    │
        │ Europe   │ │ M. East  │ │ US East  │ │ US West  │ │ Asia     │
        │          │ │          │ │          │ │          │ │          │
        │ GKE 3-50 │ │ GKE 2-30 │ │ GKE 3-50 │ │ GKE 2-40 │ │ GKE 2-40 │
        │ Redis HA │ │ Redis HA │ │ Redis HA │ │ Redis HA │ │ Redis HA │
        │ Workers  │ │ Workers  │ │ Workers  │ │ Workers  │ │ Workers  │
        └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
              │                         │
              └────────────┬────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ (PostgreSQL │
                    │  + Auth +   │
                    │  Storage)   │
                    └─────────────┘
```

---

## Per-Region Stack

| Layer            | Technology                         | Notes                              |
|------------------|------------------------------------|------------------------------------|
| Ingress          | GKE Ingress + Cloud Armor          | WAF, rate limiting, TLS termination|
| API Gateway      | Custom (Node/Deno) · 3–50 replicas | HPA on CPU + RPS                   |
| Frontend         | nginx · 2–10 replicas              | SPA, aggressive CDN caching        |
| Provider Hub     | Deno Edge · 2–20 replicas          | Smart routing, health checks       |
| AI Workers       | Node workers · 0–100 replicas      | KEDA on queue depth                |
| Queue            | Redis Streams                      | Backed by Memorystore HA           |
| Cache            | Redis (Memorystore)                | 16 GB HA, LRU eviction             |
| Secrets          | Vault + GCP Secret Manager         | KMS auto-unseal, rotation          |
| CDN              | Cloud CDN + Signed URLs            | 1h URL expiry, daily key rotation  |
| Storage          | GCS (per-region buckets)           | Private, signed access only        |

---

## Kubernetes Architecture

```
visionex-ams (namespace)
├── api-gateway        Deployment  3–50 replicas  HPA: CPU 65% / RPS 500
├── frontend           Deployment  2–10 replicas  HPA: CPU 70%
├── provider-hub       Deployment  2–20 replicas  HPA: CPU 60%
└── [NetworkPolicies, RBAC, PodSecurityStandards, PodDisruptionBudgets]

visionex-workers (namespace)
└── ai-worker          Deployment  2–100 replicas HPA: CPU 70% + queue depth

visionex-infra (namespace)
└── redis-proxy        Deployment  2 replicas

visionex-monitoring (namespace)
├── prometheus         Deployment  2 replicas     30d retention, 100 GB PV
├── grafana            Deployment  1 replica
├── loki               StatefulSet 1 replica      50 GB PV
├── promtail           DaemonSet   (all nodes)
└── otel-collector     Deployment  2 replicas     tail-sampling 5%

visionex-security (namespace)
└── vault              StatefulSet HA mode        GCP KMS unseal
```

---

## Auto-Scaling Triggers

| Service        | Scale-up Trigger                   | Min | Max |
|----------------|------------------------------------|-----|-----|
| API Gateway    | CPU > 65% OR RPS > 500/pod         |   3 |  50 |
| AI Workers     | Queue depth > 10 jobs/worker       |   2 | 100 |
| Provider Hub   | CPU > 60%                          |   2 |  20 |
| Frontend       | CPU > 70%                          |   2 |  10 |

Scale-up response: 30s window, up to +5 pods or +100% per 30s (whichever is larger).
Scale-down: 5m stabilization (10m for AI workers) to prevent thrashing.

---

## Security Controls

| Control                | Implementation                              |
|------------------------|---------------------------------------------|
| WAF                    | Cloud Armor — OWASP Top 10 + custom rules   |
| DDoS                   | Cloud Armor adaptive + rate-based ban       |
| Rate limiting (IP)     | 1,000 req/min → 5-min ban                   |
| Rate limiting (user)   | 300 req/min via `X-User-ID` header          |
| Authentication         | Supabase JWT RS256, 1h expiry, JWKS public  |
| Secrets                | Vault + GCP Secret Manager, zero plaintext  |
| TLS                    | TLS 1.3 only, HSTS preload, auto-renew      |
| Media URLs             | CDN signed URLs, 1h expiry                  |
| Network isolation      | Default-deny NetworkPolicy per namespace    |
| Pod security           | Restricted: no root, read-only FS, drop ALL |
| Image policy           | Binary Authorization — signed images only   |
| Audit logs             | All billing/auth events → BigQuery (90d)    |

---

## CI/CD — Blue/Green Deployment

```
PR → lint + typecheck → test → security scan → build image → trivy scan
                                                                     │
                                                              merge to main
                                                                     │
                                               detect active slot (blue/green)
                                                                     │
                                              deploy to INACTIVE slot ──► health check
                                                                     │           │
                                                          PASS ◄─────┘    FAIL → abort
                                                                     │
                                              switch traffic to new slot
                                                                     │
                                              drain old slot (5 min) → cleanup
                                                                     │
                                              parallel deploy to remaining 4 regions
```

Rollback: `helm rollback` restores previous revision in < 2 minutes.

---

## Failure Recovery

| Failure           | Detection           | Recovery                                           |
|-------------------|---------------------|----------------------------------------------------|
| Pod crash         | Liveness probe fail | K8s auto-restart, PDB ensures min availability     |
| Node failure      | Node not-ready      | Pod rescheduled on healthy node within 60s         |
| Region failure    | GLB health checks   | Traffic auto-rerouted to next nearest region       |
| Provider failure  | Provider Hub health | Smart router switches to next-best provider        |
| Queue failure     | Worker poll timeout | Jobs requeued with exponential backoff             |
| Billing engine    | Prometheus alert    | Idempotency keys prevent double-charge on retry    |

---

## Observability Stack

- **Prometheus** — scrapes all pods, 15s interval, 30d retention
- **Grafana** — pre-built dashboards: Global Ops, AI Analytics, Billing, Provider Performance
- **Loki + Promtail** — structured logs from every pod, indexed by namespace/app/severity
- **OpenTelemetry** — distributed tracing with tail-sampling (errors + slow traces + AI ops)
- **Alertmanager** — routes to PagerDuty (critical) + Slack (#visionex-critical / #visionex-alerts)

---

## Cost Optimization

- AI Workers scale to 0 in off-peak hours (KEDA minReplicas=0 on non-primary regions)
- Provider Hub auto-switches to cheapest provider when health scores are equivalent
- CDN cache hit rate target ≥ 90% to minimize origin requests
- Committed Use Discounts on GKE node pools (1-year commitment)
- VPA recommendations applied during maintenance windows to right-size pod resources
