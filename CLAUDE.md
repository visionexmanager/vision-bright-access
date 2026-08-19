# Claude Project Instructions

Before performing any repository task, read and follow `./AGENTS.md` completely. It is the shared source of truth for Visionex development, validation, accessibility, Supabase, security, collaboration, and deployment rules.

If `AGENTS.md` conflicts with an ad-hoc request, stop and ask the user before weakening a safety, security, accessibility, CI, or production rule.

Use `/context` when necessary to confirm that this project instruction file is loaded.

## Project skills and reviewers

Claude Code discovers the professional workflows in `.claude/skills/*/SKILL.md` automatically. Select every relevant skill from its `description`; users may also invoke one explicitly as `/skill-name`. For cross-cutting work, combine the smallest relevant set instead of loading the entire suite.

- Start complex or ambiguous work with `/deep-reasoning-planner`.
- Use `/production-code-engineer` for implementation and `/root-cause-debugger` for failures.
- Apply `/game-studio-pro` plus the relevant motion, visual, audio, accessibility, and test skills to Arcade work.
- Apply frontend/backend, API, Supabase, security, performance, and localization skills at their respective boundaries.
- Before completion, apply `/code-review-gate`; before publication use `/github-release-manager`; after deployment use `/production-verifier`.

Specialized read-only reviewers are available in `.claude/agents/`. Delegate independent architecture, security, testing, accessibility, game-quality, and release checks when risk warrants it. Treat their output as evidence to verify, not automatic approval.

Run `npm run claude:validate` after editing Claude skills, agents, hooks, settings, or this routing section.

Skills installed from elsewhere with `npx skills add` are recorded in `skills-lock.json` and validated more loosely than the ones written here: their frontmatter must parse and name their own directory, but the house authoring rules — description length, allowed frontmatter fields, the 120-line limit — apply only to skills this repository owns and can edit. Commit the lockfile alongside the skill so the set stays reviewable. Project hooks block broad deletion, force pushes, direct pushes to the default branch, destructive Git resets, and destructive database commands.
