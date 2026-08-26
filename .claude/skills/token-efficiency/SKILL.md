---
name: token-efficiency
description: How to investigate, change and verify Visionex work without wasting context. Load at the start of any task large enough to need more than one file read, and whenever the conversation is growing faster than the work.
---

# Token efficiency

**Optimize for information gained per token spent.**

## Finding things

1. Search before reading. `Grep` for the symbol, then read the lines it found.
2. Read the section, not the file. A 2,700-line webhook has a 40-line block that
   answers the question.
3. Never open a whole directory to find one thing.
4. Do not repeat a search. A search that found nothing is a result; record it and
   move on.
5. Do not explore the repository broadly, and do not open directories unrelated
   to the task.
6. Reuse what this conversation already established — see
   `.claude/references/verified-findings.md` for what earlier sessions
   established.

## Running things

7. Prefer the narrow command: one test file over the suite, `--stat` over a full
   diff, `head` over `cat` on anything long.
8. Pipe long output through `grep`, `tail` or a count. Do not paste thousands of
   lines into the window to read six of them.
9. Do not rerun a check that just passed on unchanged code.
10. Summarise output rather than quoting it, unless the exact text is the
    evidence.

## Saying things

11. Keep progress updates to a line. The user can see the tool calls.
12. Do not explain a shell command before running it.
13. Do not restate the plan, the instructions, or what was just said.
14. Report conclusions and evidence, not the path you walked to reach them.

## Spending context deliberately

15. Use `/compact` when the conversation grows large mid-task; recommend
    `/clear` between unrelated tasks. Details in
    `.claude/references/context-management.md`.
16. Delegate an independent investigation to a subagent when it would otherwise
    pull a lot of file content into this window, and ask it for findings rather
    than transcripts. Never delegate what one search would settle. Details in
    `.claude/references/subagents.md`.

The loop this all serves is in `.claude/references/workflow.md`, together with
the list of behaviours that waste the most tokens in this repository.
