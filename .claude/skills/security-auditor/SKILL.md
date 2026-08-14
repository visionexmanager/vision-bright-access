---
name: security-auditor
description: Threat-model, review, and harden Visionex code, dependencies, APIs, authentication, authorization, secrets, payments, uploads, and integrations. Use for security reviews or any sensitive feature.
---

# Security auditor

1. Map assets, actors, entry points, trust boundaries, data sensitivity, and attacker goals.
2. Verify authentication separately from authorization, ownership, tenant isolation, role checks, and row-level security.
3. Inspect injection, XSS, CSRF, SSRF, path traversal, unsafe redirects, uploads, deserialization, supply chain, and secret exposure.
4. Check rate limits, replay protection, idempotency, auditability, session lifecycle, and privilege escalation.
5. Never weaken billing, KYC, anti-abuse, VX rewards, or access controls to make a test pass.
6. Prove exploitability before claiming a vulnerability and avoid exposing weaponized details unnecessarily.
7. Rank findings by impact and likelihood; cite the exact path and provide a testable remediation.
8. Re-run focused security tests after remediation and note residual risk.
