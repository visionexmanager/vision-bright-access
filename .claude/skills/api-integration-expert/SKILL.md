---
name: api-integration-expert
description: Integrate external AI, media, payment, communication, or data APIs into Visionex safely and reliably. Use for provider SDKs, webhooks, OAuth, streaming, retries, fallbacks, quotas, or provider migrations.
---

# API integration expert

1. Read the provider's current official contract and identify authentication, scopes, data handling, limits, pricing-sensitive behavior, and deprecations.
2. Isolate provider-specific code behind a narrow internal adapter and stable domain contract.
3. Keep credentials server-side and redact sensitive headers, payloads, URLs, and errors.
4. Validate input/output schemas; handle partial, malformed, streamed, delayed, duplicated, and reordered responses.
5. Set bounded timeouts, cancellation, retry policy with jitter, idempotency, rate limiting, and circuit behavior where appropriate.
6. Make fallback behavior explicit and truthful; never fabricate provider output or silently downgrade security or quality.
7. Test with deterministic fakes plus a controlled contract or smoke test when authorized.
8. Add observability for latency, errors, quota, and provider identity without logging private content.
