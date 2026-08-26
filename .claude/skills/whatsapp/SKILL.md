---
name: whatsapp
description: Working rules for the Visionex WhatsApp assistant — the webhook, its shared modules, its migrations and its tests. Load before changing anything under whatsapp-webhook or _shared/whatsapp*, and before answering questions about what the assistant already does.
---

# WhatsApp

**Do not perform a complete WhatsApp audit when modifying an unrelated
component.** What the assistant already does, and what was already proved, is in
`.claude/references/verified-findings.md` and the two documents it names. Read
the part you are changing.

## Where things live

- `supabase/functions/whatsapp-webhook/index.ts` — delivery, routing, ordering.
  One long file; find the section, do not read it end to end.
- `supabase/functions/_shared/whatsapp*.ts` — the pure modules. Decisions,
  parsers and wording live here, which is why they are testable under Vitest.
- `supabase/migrations/*whatsapp*` — conversation state, preferences, retention.
- `src/test/whatsapp-*.test.ts` — one file per area; start with the matching one.

## Rules that hold across changes

1. Signature first: HMAC over the raw body, constant-time compare, before any
   parsing. A missing secret fails closed.
2. Deduplication is the unique `wa_message_id`; a Meta retry must stay a no-op.
3. Always answer 200. A processing failure must never invite a retry storm.
4. Language: detection is regex-based and free, a stored preference outranks it,
   and every sentence a sender reads exists in all twenty locales. New wording
   goes in `whatsappStrings.ts` plus `whatsappStringsLocales.ts` — never inline.
5. Media: validate kind and size before downloading, allowlist the host, and
   refuse with advice the sender can act on rather than a silent failure.
6. Identity is proved by a code emailed to the account, never by matching a
   phone number found on an order. Do not add a lookup that keys on a phone
   number.
7. Nothing that identifies a sender reaches a log line: no number, no address,
   no code, no message body. Lengths and outcomes only.
8. New capability means a catalog node with a `phrase`, not a new parser bolted
   into the webhook. A feature nobody is told about does not exist.

## Verifying a change

Run the matching `src/test/whatsapp-*.test.ts` first. `deno check
--node-modules-dir=none` on any `_shared/whatsapp*.ts` you touched — the flag is
required. The full suite belongs at final verification, not between edits.

For craft depth: `backend-api-master` for the webhook, `localization-guardian`
for wording, `supabase` for migrations, `security` for anything touching the
identity link.
