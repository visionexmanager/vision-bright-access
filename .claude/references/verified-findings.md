# Already verified

Work that has been audited, evidenced and merged. Treat what is written here as
trusted context.

**The rule.** Treat previously verified findings as trusted context unless a
changed file, new evidence, or a failing test invalidates them. Re-deriving a
conclusion that is already written down, with its evidence, is the most
expensive way to learn nothing.

Verified does not mean frozen. If your change touches one of these areas, read
the part you are changing — but read *that* part, not the whole area, and do not
re-audit what you are not touching.

## WhatsApp assistant — audited, phase by phase

`docs/whatsapp-ai-upgrade-progress.md` records twenty-five phases with, for each
one, what was found, what changed, what was tested and what was **not** verified.
`docs/whatsapp-ai-assistant.md` describes the live behaviour and the services it
talks to.

Do not re-audit any of this when changing an unrelated component:

- webhook signature, deduplication, the always-200 contract, per-sender rate
  limiting, outbound retry
- language detection across twenty locales, and the reply-language rules
- conversation memory, the rolling summary, transcript retention
- voice notes in, spoken replies out, the speech cache
- images, PDFs, Word and PowerPoint, local OCR and barcode decoding
- weather, shared locations, nearby places, the bazaar search
- the menu tree, the navigation engine and the session model
- the account link and order lookup, and the four scheduled retention jobs
- every interface sentence exists in all twenty languages, pinned by
  `src/test/whatsapp-locale-coverage.test.ts`

Known and deliberate, so not a defect to rediscover: video reading is built and
switched off pending Gemini credit; Arabic OCR does not work on the current
server; `.xlsx` is declined on purpose; `parserLanguage` is Arabic-and-English
by design because the phrase parsers are.

## Environment facts that cost time to relearn

- `supabase/functions/whatsapp-webhook/index.ts` has pre-existing type errors
  from an untyped Supabase client. `deno check` covers `_shared/whatsapp*.ts`
  only, in `.github/workflows/whatsapp-deno-check.yml`.
- `src/test/whatsapp-business-profile.test.ts` fails to load on a Windows
  checkout because of line endings. It passes in CI. It is not your change.
- There is no Docker, psql or local Postgres on the development machine.
  Migrations are executed with PGlite; see the `supabase` skill.

## Keeping this file honest

Add a line when a session establishes something durable that the next session
would otherwise re-derive. Delete a line the moment it stops being true. A stale
entry here is worse than no entry, because it will be trusted.
