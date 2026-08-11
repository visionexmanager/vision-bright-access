# Owner control centre

Human handoff, the reusable approval engine, and two-way owner control over
WhatsApp.

## ⚠️ WhatsApp is not connected

The internal architecture is complete and tested. **No message has ever been
sent or received**, because the Meta setup does not exist yet. Nothing in this
document should be read as "WhatsApp works".

What is built and working without WhatsApp:

- escalation records and their state machine
- the approval engine and its decision path
- owner authorization, command parsing, and takeover
- audit and feedback recording

What needs Meta before it does anything: notifying the owner, and receiving
their reply.

## One approval engine, not one per feature

`owner_approvals` is generic. `action_type` distinguishes a refund from a
content publication from a sourcing confirmation; the decision path is
identical for all of them. Adding an action type is a value in a CHECK
constraint plus an executor — never a second approval table or a second
decision flow. The future Content Engine uses this table unchanged.

```
AI raises → owner_approvals (WAITING_FOR_APPROVAL)
          → notification with reference [A7K2M]
          → owner replies
          → decide_owner_approval() claims it atomically
          → APPROVED | REJECTED  → executor → COMPLETED | FAILED
```

## Two state machines, enforced by triggers

Escalations: `WAITING_FOR_OWNER → OWNER_VIEWED → OWNER_APPROVED | OWNER_REJECTED
| OWNER_RESPONDED → RETURNED_TO_AI → RESOLVED`, with `FAILED` reachable and
recoverable.

Approvals: `WAITING_FOR_APPROVAL → APPROVED | REJECTED | EXPIRED →
PROCESSING → COMPLETED | FAILED`.

Illegal moves raise in a `BEFORE UPDATE` trigger. Decided states are terminal,
which is what makes a redelivered owner reply harmless.

## Security model

| Concern | How it is handled |
| --- | --- |
| Who is the owner | The number in `site_settings.owner_contact`, compared on normalised digits. Never hard-coded; a test forbids a phone literal in the owner path |
| Unknown sender | Treated as a customer. Never parsed as a command, whatever the text says |
| Unconfigured owner | Nobody is the owner. An unconfigured system does not promote the first caller |
| Action ownership | Every decision is tied to a `reference`, not to message text |
| Ambiguity | A bare number is honoured only when exactly one decision is pending; otherwise Visionex asks which one rather than guessing |
| Replay | `decide_owner_approval` updates `WHERE state = 'WAITING_FOR_APPROVAL'`. A second delivery matches no row and returns `not_pending` |
| Expiry | Decisions expire after 7 days by default |
| Rate limiting | 120 owner commands per hour |
| Webhook authenticity | `X-Hub-Signature-256` HMAC over the raw body; fails closed with 503 when the secret is unset |
| Privilege | `decide_owner_approval` is `REVOKE ALL` + service-role only |
| Data exposure | Escalations and approvals are admin-read; the audit stores a masked number, never a full one |

The reference alphabet omits `0/O/1/I/L` because references get dictated over a
phone, and a misread character would resolve a decision against the wrong
customer's case.

## Human takeover

`whatsapp_conversations.control` is `ai` or `human`. While it is `human` the
assistant does not reply at all, so a customer is never talking to a person and
a bot at once. Only the owner returns control.

`escalated` (automatic) and `control` (owner-set) are separate; either silences
the assistant.

## Owner commands

Reply with a number, or a word plus a reference.

| Reply | Effect |
| --- | --- |
| `1` | Take over |
| `2` | Approve |
| `3` | Reject |
| `4` | Ask AI for more information |
| `approve A7K2M` / `وافق A7K2M` | Approve that specific action |
| `reject A7K2M too expensive` | Reject, with the note recorded |
| `take over` / `أتولى` | Human owns the conversation |
| `return to ai` / `ارجع للذكاء` | Assistant resumes |
| `pending` / `المعلق` | List what is waiting |

Arabic and English both work.

## What Meta still requires

Beyond the four secrets in `docs/whatsapp-ai-assistant.md`
(`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`):

- **The owner's number must be set** in `site_settings.owner_contact`. Until
  then no owner exists and no command is accepted.
- **The 24-hour window.** Free-form messages may only be sent within 24 hours
  of that person's last message. The owner will often be notified *outside* it —
  nobody messages the business first just to receive an alert. So owner
  notifications need an **approved message template**, which is a separate Meta
  review with its own turnaround. Replies to the owner within the window are
  free-form and fine.
- **The owner's number must be able to receive** messages from the business
  number. It must not be the same number as the Cloud API sender.
- **Rate limits.** Cloud API tiers start at 1,000 business-initiated
  conversations per 24 hours; owner notifications are far below that, but
  template messages are counted.

### Not possible through the official API — do not work around

- Reading the owner's WhatsApp messages to anyone else, or acting on messages
  sent outside the business number's own conversation.
- Sending free-form text outside the 24-hour window without a template.
- Attributing a message to a person more strongly than by phone number. If
  stronger owner authentication is required, add a confirmation step in the
  admin UI rather than trusting the handset.

## Deferred and still open

Carried forward deliberately, not dropped:

- External source adapters still require per-source terms verification.
- The main Visionex store still has no native order system.
- `AIResultList` is connected to sourcing data but is not yet mounted into the
  `AIChat` conversation surface.
- External **service** sourcing is not implemented.
- NVDA / real screen-reader validation remains deferred — see
  `docs/accessibility-validation.md`.
- Full social publishing remains future work; the approval engine is ready for
  it.
- No admin UI lists escalations or approvals yet; both tables are admin-readable
  but unrendered.
