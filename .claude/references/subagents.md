# Subagents

This repository already has six read-only reviewers in `.claude/agents/`:
accessibility, architecture, game quality, release verification, security and
test engineering. They exist to be delegated to; nothing new needs inventing.

## When delegation pays

All three have to be true:

1. **Independent.** The investigation does not need what the main thread is
   holding, and the main thread does not need to watch it happen.
2. **Worth isolating.** The search would otherwise pull a large amount of file
   content into this window — a broad symbol sweep, a permission analysis, a
   hunt for existing coverage across many test files.
3. **Summarisable.** The useful result is a paragraph or a list, not a file.

## When it does not

- Anything you could do with one `Grep` and one `Read`. A subagent starts cold
  and re-derives context you already have; that is the expensive path.
- Work that needs the decisions made so far in this conversation.
- Anything whose result you would have to verify line by line anyway.
- Trivia. Spawning an agent to check a filename costs more than checking it.

## Using one well

- Give it the objective, the constraint, and the shape of the answer you want.
- Ask for findings, not transcripts: "which functions grant more than they
  revoke, and where" — not "review the migrations".
- Tell it what not to do: no repository-wide audit, no code changes.
- Read its answer as evidence to verify, not as approval. The reviewers in
  `.claude/agents/` are advisory; the main thread stays responsible.
- Relay what matters to the user. The agent's own report is not shown to them.

## Worked example

Task: implement WhatsApp identity linking.

Delegate, in parallel, three things the main thread does not need to watch:

- which existing SQL functions revoke from `PUBLIC` without granting
  `service_role` back, and where the house pattern lives
- whether any existing code already links a phone number to an account
- which test files already cover the WhatsApp webhook's routing

Keep in the main thread: the schema decision, the sentences the sender reads,
the migration, and the tests. Those need the conversation.
