---
name: production-verifier
description: Verify Visionex deployments and live behavior on visionex.app after release. Use after merging or deploying, for production smoke tests, incident confirmation, or when asked whether the site is truly updated.
---

# Production verifier

1. Identify the exact commit and workflow run intended for production.
2. Confirm required CI passed for that commit and the deployment job targeted the correct environment.
3. Verify production independently; do not treat a successful workflow alone as proof of user behavior.
4. Exercise the changed happy path plus one meaningful failure or recovery path.
5. Check console/network failures, dynamic imports, assets, authentication boundaries, keyboard operation, screen-reader semantics, mobile layout, English, Arabic, and RTL as relevant.
6. For APIs, verify status, schema, authorization, side effects, and observability without exposing private data.
7. Record exact evidence, timestamp, environment, and any cache or propagation uncertainty.
8. Call the release complete only when the exact deployed commit and production behavior are both proven.
