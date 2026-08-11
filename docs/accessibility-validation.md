# Accessibility validation — standing requirement and deferred tasks

The primary user of this platform is blind. Accessibility is an architectural
requirement on every change, not a phase that completes.

## Standing requirements for every new AI feature and UI component

Applied to everything added in Phases 1–3 and required of everything after:

- Semantic HTML. A list is `<ol>`/`<ul>`, a comparison is `<table>` with scoped
  headers, a menu is `<nav>`. A `<div>` grid loses the relationships a screen
  reader needs to say which attribute a cell belongs to.
- Every control keyboard reachable and operable. No keyboard traps. A
  scrollable region that can overflow is focusable, or it is unreachable
  without a mouse.
- Accessible names that carry the whole meaning. If a sighted user learns
  something from position, colour or layout, that fact belongs in the name.
- Focus management on every state change: moving into a new menu level, opening
  results, opening a comparison, and moving back.
- Dynamic changes announced through a live region, `aria-atomic` where the
  sentence only makes sense whole.
- State as text, never colour alone. "Used", "Available for sourcing" and
  "Price on request" are words.
- RTL and Arabic throughout. Logical properties (`me-*`, `text-start`), and
  `dir` set where content direction differs from the page.
- No visual-only interaction. Anything that can be clicked can be typed or
  spoken — the numbered menu exists for exactly this reason.

## Deferred: dedicated screen-reader pass

**Status: outstanding. Must be completed before production release.**

No screen reader exists in the development environment, so nothing below has
been heard. What has been verified is the *semantics a screen reader consumes* —
roles, accessible names, headings, focus movement, live regions — in a real
browser and in automated tests. That is a necessary condition, not a sufficient
one.

Two tooling caveats found while verifying, worth knowing before trusting a
future automated check:

- The in-app browser's accessibility snapshot **stripped the leading number**
  from menu options and under-reported that subtree. Accessible names were
  computed directly from the DOM instead.
- jsdom passed a menu implementation that split the option number across an
  `aria-hidden` span and an `sr-only` copy. Whether that is announced depends on
  how a given screen reader treats clipped text — jsdom cannot tell you.

### What to test, and against what

| Surface | What to confirm |
| --- | --- |
| Numbered menu (`AIMenu`) | Each option is announced with its number; typing that number does the same thing; the level heading is announced on descend and on Back; no Back is offered at the root |
| Result list (`AIResultList`) | The count is announced on arrival; new and used read as separate groups; condition, availability and price are heard for every item |
| Comparison (`AIComparison`) | Row headers are announced with each cell; the table is reachable and scrollable by keyboard |
| Contact Us | The four department addresses read as "Technical Support: support@visionex.app"; the Department control is labelled |
| Content Hub | Empty and error states are announced; the unlock link receives focus after purchase |

Cover **NVDA** and **JAWS** on Windows, **VoiceOver** on macOS/iOS, and
**TalkBack** on Android, in both English and Arabic — the Arabic pass matters
independently because direction and announcement order change.

### Recording the outcome

Findings belong in an issue per surface, not in this file. Anything that does
not work well for a blind user is a defect to fix, not a limitation to
document.
