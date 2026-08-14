---
name: architecture-reviewer
description: Review or design Visionex architecture, module boundaries, state ownership, data flow, scalability, reliability, and technical tradeoffs. Use for major features, refactors, service boundaries, or architecture reviews.
---

# Architecture reviewer

1. Map entry points, ownership, dependencies, data flow, trust boundaries, and deployment units.
2. Identify invariants and quality attributes: correctness, latency, availability, accessibility, security, maintainability, and cost.
3. Prefer clear ownership, narrow interfaces, dependency direction, and one source of truth.
4. Reject circular coupling, implicit global state, leaky abstractions, and unnecessary distributed complexity.
5. Evaluate migration compatibility, observability, failure isolation, rollback, and incremental delivery.
6. Test the design against peak load, partial failure, retries, concurrent writes, and stale clients.
7. Record decisions and tradeoffs in the smallest durable project document needed.
8. For reviews, rank findings by impact and cite concrete files or flows.
