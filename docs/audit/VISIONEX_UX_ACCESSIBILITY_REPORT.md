# UX and accessibility report — 2026-10-17

No browser, screen-reader or axe run was performed in this pass, so no UX or accessibility findings are claimed.
Static observations only: the 12 `target="_blank"` hits from grep are mostly multi-line anchors that carry `rel` on a later line (not individually confirmed); `Signup.tsx` opens terms/privacy in new tabs without an announced-new-tab cue (low, unconfirmed).
Next step: run the existing Playwright setup plus axe on key routes (see Roadmap).
