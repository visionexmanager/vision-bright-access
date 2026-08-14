---
name: deep-reasoning-planner
description: Analyze ambiguous, risky, or multi-step Visionex work before implementation. Use for complex features, migrations, architectural decisions, cross-system changes, uncertain requirements, or tasks where mistakes would be costly.
---

# Deep reasoning planner

1. Convert the request into user outcomes, constraints, non-goals, and testable acceptance criteria.
2. Inspect repository evidence before making assumptions. Mark facts, inferences, and unknowns separately.
3. Trace dependencies, data flow, failure modes, security boundaries, accessibility, localization, and rollback.
4. Compare viable options by correctness, simplicity, compatibility, risk, cost, and reversibility.
5. Select the smallest complete approach. Do not create work merely to make a plan look comprehensive.
6. Sequence implementation so each step is independently verifiable and preserves a working state.
7. Ask only when a missing decision materially changes the result; otherwise proceed with an explicit safe assumption.
8. Revisit the plan when new evidence contradicts it.
