---
name: production-code-engineer
description: Build, refactor, diagnose, test, and optimize maintainable production code in Visionex. Use for implementation, bug fixes, TypeScript, React, Node, APIs, reliability, or any request for professional code.
---

# Production code engineer

1. Read `AGENTS.md`, inspect the actual code path, and define observable acceptance criteria.
2. Reproduce or prove the problem before deciding on a fix.
3. Identify the root cause and affected invariants; distinguish symptoms from unrelated warnings.
4. Choose the smallest cohesive design that fits existing architecture.
5. Use explicit errors and stable contracts. Avoid placeholders, silent catches, duplicated truth, speculative abstractions, and hidden fallbacks.
6. Validate inputs at trust boundaries. Consider cancellation, timeouts, retries, idempotency, concurrency, and partial failure.
7. Add regression tests and apply `.claude/references/quality-gates.md`.
8. Report evidence, remaining uncertainty, and operational risk honestly.
