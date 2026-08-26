# The working loop

Loaded when a task is larger than a one-line edit. Not printed to the user.

```
TASK → UNDERSTAND → TARGETED SEARCH → MINIMAL READ → PLAN
     → SMALL CHANGE → TARGETED TEST → (repeat) → FINAL VERIFICATION → REPORT
```

## Task start

1. Restate the technical objective to yourself. Not to the user.
2. Name the smallest area that can contain the answer — a directory, a module, a
   migration, one test file.
3. Search for exact symbols and filenames. `Grep` for a symbol beats `Read` on a
   directory, and both beat asking a subagent to look around.
4. Read only the sections the search pointed at.
5. Write a minimal plan: the files to change and the check that will prove it.
6. Implement.
7. Run the smallest test that can fail for this change.
8. Continue from where you are. Do not restart the investigation.
9. Final verification once, when the implementation is otherwise complete.
10. Report what changed, what was proved, and what was not.

## Rules for the loop

- Do not restart the investigation after every change. The findings from step 3
  stay valid until a file you changed, or a failing test, contradicts them.
- Do not reread a file you have already read unless you or a tool changed it.
- Do not run the full suite between small changes. Targeted tests are the inner
  loop; the full suite is the outer one.
- Do not chase unrelated issues found in passing. Note them in the report, or
  raise a background task, and carry on.
- A search that returned nothing is an answer. Do not run it again in another
  form unless you have a reason to expect a different result.

## What wastes the most tokens here

Never do these without being asked:

- "Let me inspect the entire repository." There are 155 test files and ~1,000
  source files. A repository-wide read is never the cheapest way to answer a
  question.
- Reading every file in a directory when one symbol was wanted.
- Repeated `git log` or `git diff` dumps of large ranges. Ask for the specific
  file, range, or `--stat`.
- Rerunning a full test suite that just passed, unchanged.
- Rereading an unchanged file to "confirm" something already established.
- Re-searching documentation already summarised earlier in the task.
- Investigating warnings unrelated to the task.
- Rewriting working code without evidence that it is wrong.
- Narrating each shell command, or explaining what a command does before
  running it.
- Re-confirming a fact the conversation already settled.

## Reporting

State the outcome, the evidence, and the gaps. No step-by-step retelling of the
investigation, no restating of the instructions, no summary of what the user
already knows. If a check did not run, say which and why.
