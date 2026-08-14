---
name: performance-optimizer
description: Measure and improve Visionex runtime speed, bundle size, rendering, network use, database queries, memory, media loading, and game frame stability. Use for slow pages, jank, high resource use, or performance budgets.
---

# Performance optimizer

1. Define the user-visible metric and budget before optimizing: latency, frame time, interaction delay, bundle bytes, memory, or query cost.
2. Capture a repeatable baseline with representative data, device, network, and route.
3. Profile to locate the dominant bottleneck; do not optimize from intuition alone.
4. Prefer eliminating work, reducing payloads, batching, indexing, caching safely, lazy loading, and narrowing rerender scope.
5. Preserve correctness, accessibility, freshness, cleanup, and low-end-device behavior.
6. Check cache invalidation, stale data, memory retention, long tasks, N+1 queries, and dynamic-import failures.
7. Compare before/after measurements and add a budget or regression check when stable.
8. Record tradeoffs and reject improvements too small to justify complexity.
