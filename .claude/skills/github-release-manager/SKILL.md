---
name: github-release-manager
description: Safely commit, push, review, merge, deploy, and verify Visionex changes through GitHub and visionex.app. Use when the user asks to publish, upload, commit, push, open or merge a PR, deploy, continue a release, or verify production.
---

# GitHub release manager

1. Read `AGENTS.md` and `.claude/references/quality-gates.md`.
2. Inspect branch, worktree, diff, remote main, repository policy, and required checks.
3. Work on a focused `claude/` branch; never commit directly to `main` or overwrite unrelated changes.
4. Run risk-appropriate validation and scan the diff for secrets, generated noise, missing tests, locale gaps, and accessibility regressions.
5. Create a concise commit and pull request describing outcome, risk, validation, and deployment considerations.
6. Require CI on the latest head commit. Fix root causes; never bypass a failed gate.
7. Merge only after required checks pass, then track the exact merge commit through deployment.
8. Verify production independently and distinguish completed, pending, and blocked states.
