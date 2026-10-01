# WhatsApp Admin

Not a customer chatbot. Only enrolled admins get any response; everyone else gets silence.

## Identity (three independent factors)
1. **Allow-listed number** — a SUPER_ADMIN creates it in the web UI (`/whatsapp-admins`). The UI shows,
   once, an 8-digit enrolment code (30 min, single use) and an authenticator seed.
2. **Proof of control** — the person sends `enroll <code>` from that number; only then is it `ACTIVE`.
3. **Unlock** — each session starts with `unlock <6-digit authenticator code>` (replay-proof). It expires after
   15 idle minutes; `lock` ends it. Unlock attempts are limited to 5 per 15 minutes.

A phone number alone never authenticates. Disabling a number in the UI takes effect on the next message.

## Transport security
* **Relay mode (recommended):** the public webhook forwards verified Meta payloads to
  `POST /internal/v1/whatsapp/events` with headers `x-isp-timestamp` (unix seconds) and
  `x-isp-signature = hex(HMAC_SHA256(WA_GATEWAY_HMAC_SECRET, "<timestamp>.<raw body>"))`. ±60 s skew allowed.
  **The relay itself is not written** — the existing public WhatsApp function was deliberately left untouched.
  This is the contract it must follow.
* **Direct mode:** `WA_DIRECT_WEBHOOK=true` exposes `GET/POST /wa/webhook`, verifying Meta's
  `X-Hub-Signature-256` over the raw body. Off by default (the routes 404).
* Both: invalid signature → 401 + `WA_SIGNATURE_INVALID` event (3 in 10 min alerts the owners); malformed →
  400; messages older than 5 minutes are dropped; each message id is accepted once (`wa_inbound`).

## Interaction
Buttons and lists only (max 3 buttons / 10 list rows, titles clipped to Cloud API limits); never "reply 1".
Every screen has **Back**; `home`, `back`, `cancel`, `lock`, `help` work as text.

Commands (equivalent wording is accepted): `customer 12345`, `check abc123`, `username abc123`,
`find mohammad`, `radius abc123`, `active sessions abc123`, `payment 12345`, `service 12345`,
`suspend|resume|activate abc123`. `expiring today / this week` replies that PI exposes no verified expiry
query yet.

Dangerous actions: the bot shows customer, status now → after, expiry (2 min), with **Confirm** /
**Cancel** / **Back** buttons. Typing "yes/confirm" does nothing. A redelivered tap runs once and replies
"already processed". Another admin's confirm button is a 404.

## AI boundary
Deterministic parsing handles the commands above. An optional `IntentInterpreter` can be supplied for looser
wording (none is configured). Its output is untrusted: validated against a closed zod schema that contains
no `CONFIRM`, no `TERMINATE` and no tools; a proposed action still goes through request → confirm → audit and
is authorised by the backend independently. The model has no access to the database, RADIUS or PI.

## Roles
`WHATSAPP_ADMIN` (look up + suspend/resume/activate), `READ_ONLY_ADMIN` (look up only — action buttons are not
offered), `ADMIN`, `SUPER_ADMIN` (also receives critical alerts).

## Kill switch
SUPER_ADMIN → System → "Disable WhatsApp actions" (or all changes). Lookups keep working.
