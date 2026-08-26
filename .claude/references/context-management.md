# Context management

Five commands, and when each one is the right answer.

| Command | Use it when |
| --- | --- |
| `/context` | You need to see what is actually occupying the window before deciding what to do about it. |
| `/compact` | The conversation has grown large and the task is not finished. |
| `/clear` | The next piece of work is unrelated to this one. |
| `/cost` | Checking what this session has spent. |
| `/usage` | Checking the plan's remaining limits. |

## Compacting

Recommend `/compact` when the window is filling and the task still has stages
left. Keep, in the summary:

- the current task and its acceptance criteria
- the files modified so far, and what changed in each
- architectural decisions and the reason for each
- failing tests, with their exact output
- verification that already succeeded, so it is not repeated
- remaining blockers
- the exact next step

Discard:

- repeated explanations of the same idea
- exploratory search output and directory listings
- command output that has been superseded
- investigations that reached a conclusion — keep the conclusion, drop the path
- file contents that were read but not changed

## Clearing

Recommend `/clear` **between** tasks, never inside one. Finishing a WhatsApp
change and moving to an Arcade bug is a clear. Finishing the implementation and
starting the verification of the same change is not — the verification needs
what the implementation established.

If a task's context is worth keeping across a clear, write it down first: a
memory file for a durable fact, a note in the pull request for a decision, a
line in `.claude/references/verified-findings.md` for something the next session
would otherwise re-derive.

## Watching the window

Compaction is cheaper than re-derivation, and both are more expensive than not
reading the file twice in the first place. Prefer the third.
