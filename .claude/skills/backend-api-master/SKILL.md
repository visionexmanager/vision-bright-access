---
name: backend-api-master
description: Design, implement, debug, and secure Visionex backend services, Edge Functions, webhooks, jobs, and APIs. Use for server code, request handling, authentication, authorization, rate limits, queues, or service reliability.
---

# Backend and API master

1. Define stable input/output contracts, authentication, authorization, ownership, tenant scope, status codes, and safe errors.
2. Validate all untrusted input and bound payload size, time, retries, concurrency, and resource use.
3. Design writes for transactions and idempotency; prevent duplicate billing, rewards, webhook processing, and side effects.
4. Apply least privilege and keep secrets server-side. Never log tokens, private data, or unsafe raw payloads.
5. Handle timeouts, cancellation, downstream failure, retry jitter, rate limits, and poison messages deliberately.
6. Add structured observability without sensitive data and make failures diagnosable.
7. Test unauthorized, forbidden, invalid, duplicate, concurrent, timeout, dependency-failure, and success cases.
8. Preserve backward compatibility or provide a staged migration and rollback.
