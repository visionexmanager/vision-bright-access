# WhatsApp AI assistant

## What exists in the repository

`supabase/functions/whatsapp-webhook/` receives WhatsApp Cloud API webhooks,
answers with the existing Visionex assistant, and logs every turn.

It introduces no new AI. `whatsapp-support` is an entry in the same
`supabase/functions/_shared/assistants.ts` registry the website uses, streamed
through the same `_shared/aiProvider.ts` and the same `OPENAI_API_KEY`. Moving
it to Claude or Gemini later is a two-field change in the registry, exactly as
for every other assistant.

What it does per message:

1. Verifies `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET` over the raw
   request body. An unsigned or mis-signed delivery is refused with 403.
2. Sends the welcome message on the first contact from a number.
3. Detects Arabic vs. English from the message text and answers in kind.
4. Replays up to 12 prior turns so the conversation has memory.
5. Escalates — and stops answering — when the user asks for a person, when the
   assistant says it is handing over, or when the AI provider is unreachable.
6. Writes everything to `whatsapp_conversations` / `whatsapp_messages`, which
   only admins can read.

## What is NOT possible from this repository

**The assistant cannot reach anyone until WhatsApp Business Platform access
exists.** Before this change the site had only `https://wa.me/<number>` links —
a deep link that opens the WhatsApp app on the user's phone. A `wa.me` link is
not an API: nothing is delivered to any server, so no automation can observe or
answer it. That is true of a normal WhatsApp Business app account as well; the
Business *app* has no webhooks.

Receiving and sending programmatically requires the **WhatsApp Business
Platform (Cloud API)**, which is set up in Meta's console, not in Git.

### Setup, done once, outside this repository

1. A Meta Business account with a verified business.
2. A WhatsApp Business Platform app in <https://developers.facebook.com>.
3. A phone number registered to that app. **It cannot be a number already
   active in the regular WhatsApp or WhatsApp Business app.** This was settled
   by taking a separate number rather than migrating the old Lebanese handset:
   the Cloud API number is `+44 7732 729713`, and the site now links to it.
4. In the app's WhatsApp → Configuration page, set the callback URL to
   `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, paste the
   same string used for `WHATSAPP_VERIFY_TOKEN`, and subscribe to the
   `messages` field.
5. Generate a **permanent** access token via a System User. The 24-hour
   development token will silently stop the assistant the next day.

Twilio, 360dialog, or another BSP is an alternative to going direct. It is not
required — the Cloud API is free for service conversations within the 24-hour
customer service window — and it would mean a different webhook payload shape,
so `_shared/whatsapp.ts` would need a second parser. Going direct is simpler
here.

### Secrets

Set as GitHub repository secrets; `deploy.yml` syncs them to Supabase Edge
Function secrets on the next deploy. They are optional there — an unset secret
is skipped, not an error.

| Secret | Purpose |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Any random string. Also typed into the Meta console for the one-time handshake. |
| `WHATSAPP_APP_SECRET` | Meta app secret. Verifies that a delivery really came from Meta. |
| `WHATSAPP_TOKEN` | Permanent System User access token. Used by **both** send paths. |
| `WHATSAPP_PHONE_NUMBER_ID` | Cloud API phone number id (not the phone number). |

`WHATSAPP_ACCESS_TOKEN` is **retired**. It was a second name for the same
credential, read only by `bazaar-notify-seller`, which meant configuring one
name left the other send path silently dead. Both paths now read
`WHATSAPP_TOKEN`. Do not reintroduce the old name.

### Confirmed Meta identifiers

None of these are secret and none are read by the runtime — the code takes the
phone number id from `WHATSAPP_PHONE_NUMBER_ID` and the app id from
`META_APP_ID`. They are recorded here so the console and the server can be
checked against each other.

| Item | Value |
| --- | --- |
| Meta App (`visionex llc`) | `1423401982996953` |
| Business portfolio (`visionex.app`) | `1394846605906328` |
| WABA (`visionex`) | `1997975370907272` |
| Phone number id | `1315463974979129` |
| Phone number | `+44 7732 729713` |
| System user (`visionex_whatsapp_server`) | `61593586373093` |
| Graph API version | `v26.0` |

The Graph version lives in `supabase/functions/_shared/meta.ts` and is used by
every Meta call. `META_GRAPH_API_VERSION` overrides it and is intentionally not
synced by `deploy.yml`; it exists so a retired version can be moved with
`supabase secrets set` without waiting for a deploy.

`appsecret_proof` is **not implemented**. Leave "Require app secret proof for
server API calls" switched off in the App Dashboard — turning it on would make
every Graph call fail with an error that reads like a token problem.

No credential belongs in the source tree, and a test asserts the webhook reads
all four from the environment.

## The business profile

What a customer sees when they tap the business name — the about line, the
description, the support address, the websites, the industry — is public
company information. WhatsApp Manager will happily let it be typed in by hand,
which leaves no review, no history, and no way to tell whether what is live is
still what anyone agreed to. So it lives in the repository, in
`supabase/functions/_shared/business-profile.json`, and
`scripts/whatsapp-profile.mjs` is the only thing that writes it.

| Field | Limit | What it is |
| --- | --- | --- |
| `about` | 139 chars | The line under the business name. |
| `description` | 512 chars | The paragraph on the profile. Bilingual. |
| `email` | 128 chars | `support@visionex.app`. One address only — the API has no second field. |
| `websites` | 2 entries, 256 chars each | `https://visionex.app` and the contact form. |
| `vertical` | enum | `PROF_SERVICES`. An unlisted value is rejected without listing the valid ones. |
| `address` | 256 chars | Deliberately empty — Visionex has no walk-in office. |
| `profile_picture` | 5 MB, square, ≥192px | A path, not a Graph field. See below. |

**The Cloud API has no field for business hours.** Opening hours are a feature
of the WhatsApp Business *app*, not of the Business Platform, and no amount of
looking for the field will produce one. Support hours are therefore stated in
`description`, and the `whatsapp-support` prompt in `_shared/assistants.ts` is
given the same facts so the assistant answers "when are you open?" with what
the profile claims. `src/test/whatsapp-business-profile.test.ts` fails if the
profile, the prompt, and the Contact page copy in `src/i18n/en.ts` drift apart
on the hours or the response time.

### The profile picture

`profile_picture` is a path in this repository, not a Graph field. Setting the
picture takes two extra round trips — open a resumable upload session against
the Meta app, send the bytes, receive a handle — and it is the handle that goes
into the profile write as `profile_picture_handle`. The upload runs first, so a
logo Meta rejects leaves the rest of the profile untouched.

It points at `public/favicon.png`: the logo the website already serves, not a
copy of it. A second copy is a second thing to keep current, and the WhatsApp
profile is exactly the surface nobody would remember to update.

WhatsApp wants a square of at least 192px and crops it to a circle, and the
logo is 1536x1024. `scripts/lib/square-png.mjs` pads it to 1536x1536 with black
bars, which are invisible against the artwork's own black background and keep
the whole mark inside the circle — a centre crop would take the tips of the X
first. The padding happens on every publish rather than being committed as a
second image.

It works on the compressed scanline stream, without an image library: a PNG row
is a filter byte followed by the row's bytes, so a row of zeros is filter
"None" plus RGB (0,0,0) — black — and because the filters treat the row above
the first as zeros, prepending zero rows leaves every original row decoding
exactly as before. That only holds for 8-bit truecolour. In an RGBA export a
zero row is *transparent*, so the script refuses anything else rather than
publishing a smear, and a test asserts the committed logo is still a format it
can handle.

The picture is the one field `check` cannot compare: reading returns a CDN URL,
writing takes a single-use handle, and neither is derivable from the other. It
reports whether a picture is set, and nothing about whether it is the current
one.

`META_APP_ID` is needed for this and only this — the upload session belongs to
the app, not to the phone number.

### Publishing

Run **WhatsApp Business Profile** from the Actions tab:

- `mode: check` — reads the live profile and reports every field that differs
  from the file. Fails the run on drift. Safe at any time; it writes nothing.
- `mode: push` — writes the file to Meta, then reads it back and diffs, so a
  write Meta accepted but did not apply is a red run rather than a silent one.

It is manual on purpose and is not part of Deploy: rewriting what customers
read on the profile is a communications decision, not a side effect of shipping
code. The job runs in Actions rather than on a laptop because `WHATSAPP_TOKEN`
is a permanent System User token — running it locally means copying that token
out of the secret store and into a shell history.

`npm run whatsapp:profile` validates the file offline, with no credentials and
no network. It is what the workflow runs before it touches Meta, and what the
test suite runs in CI.

## Behaviour before the credentials exist

The function is deployed and inert, and fails in the safe direction:

- `GET` without a matching verify token → `403`.
- `POST` with `WHATSAPP_APP_SECRET` unset → `503`, nothing is processed.
- If only the sending credentials are missing, an incoming message is still
  verified and logged, and the missing reply is recorded in the function log.

The `wa.me` links on the site keep working exactly as before either way.

## The 24-hour window

Meta only allows free-form replies within 24 hours of the user's last message.
The assistant always replies immediately, so it stays inside the window. Any
future feature that messages a user first — an order update, a follow-up — needs
a pre-approved message template, which is a separate Meta review.

## Testing before it is live

Signature verification, payload parsing, language detection, escalation
triggers, and reply clamping are covered by
`src/test/whatsapp-assistant.test.ts` and run in CI without any credentials.

Once the Meta setup exists:

1. Save the callback URL in the Meta console. It should turn green — that is
   the `GET` handshake.
2. Use the console's **Send test message** button, then reply from the real
   handset. The first reply should be the welcome text.
3. Send "بدي احكي مع حدا" and confirm the handover sentence comes back and that
   `whatsapp_conversations.escalated` is true.
4. Confirm a repeated delivery does not double-answer: Meta retries on any
   non-200, and the unique index on `wa_message_id` makes the retry a no-op.
5. Check `supabase functions logs whatsapp-webhook` for refused signatures.
