---
name: code-review-gate
description: Perform a rigorous final review of Visionex changes before commit, pull request, or merge. Use after implementation, when asked to review code, or before declaring a coding task complete.
---

# Code review gate

1. Read the request, acceptance criteria, `AGENTS.md`, changed files, and full diff.
2. Trace changed execution paths; do not judge isolated lines without their callers and contracts.
3. Prioritize correctness, data loss, security, authorization, privacy, accessibility, localization, reliability, performance, and missing regression tests.
4. Check duplicated truth, stale state, cleanup, async races, error handling, compatibility, and rollback.
5. Confirm changes are scoped and no user work, secrets, generated noise, or unrelated formatting entered the diff.
6. Cite exact files and explain observable impact plus a testable fix.
7. Do not invent findings to fill a list. If no blocking issue remains, say so and state residual test gaps.
8. Re-review after fixes rather than assuming the first recommendations were implemented correctly.
