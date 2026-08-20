# Visionex — WhatsApp Cloud API: handoff summary

State as of commit `d55c271c` on `main`. Everything below is merged, deployed
and verified in production. Written for an agent picking this up cold.

---

## 1. What this is

Visionex runs the **Meta WhatsApp Cloud API** directly (no BSP). Inbound
messages hit a Supabase Edge Function, are answered by the existing Visionex
assistant, and are logged. The account owner can also drive an approval queue
over the same channel.

**Non-secret identifiers** (safe to use, none are credentials):

| Item | Value |
| --- | --- |
| Meta App (`visionex llc`) | `1423401982996953` |
| Business portfolio (`visionex.app`) | `1394846605906328` |
| WABA (`visionex`) | `1997975370907272` |
| Phone number id | `1315463974979129` |
| Phone number | `+44 7732 729713` |
| System user (`visionex_whatsapp_server`) | `61593586373093` |
| Graph API version | `v26.0` |

`61593586373093` is a **System User**, not an App ID — it is what mints the
permanent token. Do not confuse the two.

---

## 2. Runtime pieces

| File | Role |
| --- | --- |
| `supabase/functions/whatsapp-webhook/index.ts` | Inbound webhook + owner command handling |
| `supabase/functions/_shared/whatsapp.ts` | HMAC verify, payload parsing, send helper |
| `supabase/functions/_shared/meta.ts` | Single source of truth for the Graph version |
| `supabase/functions/_shared/ownerControl.ts` | `isOwner()`, `normalizePhone()`, command parsing |
| `supabase/functions/owner-control/index.ts` | Admin write path (Owner Control Centre) |
| `supabase/functions/bazaar-notify-seller/index.ts` | Second sender (Bazaar seller alerts) |

Live webhook URL:
`https://nnyxtaftwispowolajpl.supabase.co/functions/v1/whatsapp-webhook`

Tables: `whatsapp_conversations`, `whatsapp_messages` — RLS on, service-role
writes, admin-only reads.

---

## 3. What changed recently, and why

### PR #151 — `e081e2da` "Give every Meta call one version and one token name"

Three defects, each of which failed silently rather than loudly.

**Graph API version drift.** Three call sites had been written against three
different versions: `v21.0` for assistant replies, `v20.0` for Bazaar
notifications, `v21.0` for social OAuth. Meta retires a version roughly two
years after release and answers a retired one with an error that reads like a
permission problem, so the oldest call site would have broken first and been
misdiagnosed as a token fault.

Fixed by `_shared/meta.ts`, which decides the version once:

```ts
export const GRAPH_VERSION  = env("META_GRAPH_API_VERSION") ?? "v26.0";
export const GRAPH_BASE     = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const FB_DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}`;
```

**Gotcha worth keeping:** it reads the env through a `globalThis.Deno` probe,
not `Deno.env.get()` directly. The Vitest suite imports `_shared/whatsapp.ts`
under Node, where `Deno` is undefined — a bare reference at module scope throws
at import time and takes the whole WhatsApp test file down. Do not "simplify"
this.

`META_GRAPH_API_VERSION` is deliberately **not** synced by `deploy.yml`. It is
an escape hatch so a retired version can be moved with `supabase secrets set`
without waiting for a full deploy.

**Two names for one credential.** `whatsapp-webhook` read `WHATSAPP_TOKEN`;
`bazaar-notify-seller` read `WHATSAPP_ACCESS_TOKEN`. Same Cloud API token, so
configuring one left the other send path dead — no error, just seller
notifications that never arrived. `WHATSAPP_TOKEN` is now canonical everywhere.
**`WHATSAPP_ACCESS_TOKEN` is retired — do not reintroduce it.**

**A secret inventory that could not see the gap.** `health-check` listed only
the two names the Bazaar path used, so the four the webhook depends on could be
absent in production with nothing reporting it — which is exactly what had
happened. All four are listed now, plus `META_APP_ID` / `META_APP_SECRET`.

Also fixed: `social-oauth` reads `META_APP_ID`, `META_APP_SECRET`,
`SOCIAL_TOKEN_ENCRYPTION_KEY` and `SOCIAL_OAUTH_STATE_SECRET` — **none were in
the `deploy.yml` sync loop**, so that flow could never have been configured no
matter what was set in GitHub. All four were added.

Public `wa.me` links moved off the old Lebanese handset (which has no webhook
behind it) to the Cloud API number, in `ContactUs.tsx` and
`AssistiveProducts.tsx`.

### PR #152 — `d55c271c` "add owner WhatsApp number settings"

**The Owner Control Centre had been inert since it shipped.** The webhook reads
`site_settings.owner_contact.whatsapp_number` to decide who may issue owner
commands, and it shipped seeded `null`. Not a permission problem — the
`Admins can manage site settings` policy always allowed the write. There was
simply no control anywhere: `/admin/settings` had seven hardcoded fields and
none was this one, `/admin/database` is read-only, and the Control Centre only
read the value.

**A latent data-corruption bug had to be fixed in the same change.**
`AdminSettings.tsx` did `select("*")` — which for an admin includes
`owner_contact` — stringified every loaded value into state, then stringified
again on save. A jsonb **object** went back as a jsonb **string**, after which
`value.whatsapp_number` is `undefined` and there is no owner at all. Editing the
site name was enough to trigger it. Harmless while the value was `null`;
destructive the moment it was set.

Fixed with two independent guards: `load()` fetches only `MANAGED_KEYS` via
`.in()`, and `handleSave()` iterates that list rather than
`Object.entries(settings)`. Removing the double encoding also stopped plain text
settings from gaining a pair of quotes on every save.

**The field lives in the Owner Control Centre and saves through the
`owner-control` Edge Function, not the browser.** Two standing tests forbid
direct table writes from that screen — `owner-dashboard.test.tsx:85` and
`content-owner-control.test.tsx:309` — and the reason applies here: the row also
holds notification flags, so setting the number is a read-modify-write, and two
admins saving at once from a browser would silently drop one of the other keys.

New action `set_owner_contact` sits behind the function's **existing** admin gate
(`auth.getUser()` → `role = admin` → 403). It adds no second authorization path.
It merges rather than replaces:

```ts
const value = { ...preserved, whatsapp_number: digits };
```

Validation reuses `normalizePhone()` and the `>= 8` digit floor `isOwner()`
already applies — storing a number `isOwner()` could never match would be worse
than storing none. The number is masked on screen, and `audit_logs` records only
its length.

---

## 4. Secrets — names only, never values

Configured in **GitHub Actions**, synced to Supabase Edge Function secrets by
`deploy.yml` on each deploy:

```
WHATSAPP_TOKEN            # permanent System User token, both send paths
WHATSAPP_APP_SECRET       # verifies X-Hub-Signature-256
WHATSAPP_VERIFY_TOKEN     # Meta callback handshake
WHATSAPP_PHONE_NUMBER_ID  # 1315463974979129
META_APP_ID               # 1423401982996953
```

**Not configured** (social publishing only; not a WhatsApp blocker):
`META_APP_SECRET`, `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SOCIAL_OAUTH_STATE_SECRET`.

Rules: never read, print, log or commit a value. `deploy.yml` skips an unset
secret with a notice rather than failing. Paste values with **no trailing
newline** — `supabase secrets set` stores them verbatim and a stray newline
breaks signature verification in a way that looks like a Meta fault.

---

## 5. How to verify production without credentials

The webhook's failure modes are diagnostic on purpose:

| Probe | Meaning |
| --- | --- |
| `POST` unsigned → **503** | `WHATSAPP_APP_SECRET` missing |
| `POST` unsigned → **403** | secret loaded, signature check reached — healthy |
| `GET` wrong verify token → **403** | correct; cannot distinguish unset from mismatched |
| nonexistent function → **404** | control, proves 401/403 is not a generic reply |

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://nnyxtaftwispowolajpl.supabase.co/functions/v1/whatsapp-webhook -d '{}'
```

**Traps that produce false results:**

- A missing asset on `visionex.app` returns **index.html with HTTP 200**. Check
  `content-type`, not the status code.
- `owner-control` is **not** in the `verify_jwt=false` list, so the gateway
  returns 401 before the function runs. Its switch statement is unreachable from
  outside without an admin JWT.
- The deploy log echoes the workflow script itself, so strings like
  `::error::GitHub secret OPENAI_API_KEY is not configured` appear as script
  text, not as failures.

---

## 6. Current state and what remains

Live and verified: webhook answering, signature verification, end-to-end owner
test passed, owner number saved through the new UI.

The `owner_contact` **shape** has not been verified by an agent — the row is
hidden from anon reads by RLS (`USING (key NOT IN ('owner_contact'))`) and
reading it needs an admin session. Verified externally only that it is not
publicly readable and that the number leaks into no anon-readable table.

**In progress, not started:** WhatsApp Business Profile setup in WhatsApp
Manager (display name, description, email, website, hours, category, logo).
Blocked on the official business address (must not be guessed) and the official
logo file. The business category needs a human choice between plausible options.

**Open, unrelated to WhatsApp:** Meta business verification is still
`Unverified`, which caps messaging tiers. `appsecret_proof` is **not
implemented** — leave "Require app secret proof for server API calls" switched
OFF in the App Dashboard, or every Graph call fails with an error that reads
like a token problem.

---

## 7. Hard rules

Do not modify without explicit instruction: `isOwner()`, `normalizePhone()`,
owner command parsing, the 120/hour rate limit, HMAC verification, webhook
security, the JWT exemption lists (`config.toml` **and**
`scripts/deploy-changed-supabase-functions.sh` — only the script reaches
production), retry/idempotency (`wa_message_id` unique index), RLS policies.

Do not reintroduce `WHATSAPP_ACCESS_TOKEN`. Do not hardcode any phone number in
application source — the owner number lives in `site_settings`, the business
number in two page constants. Do not enable `appsecret_proof`.

A bare digit `1`–`4` sent to the business number from the owner's handset is a
**command** (`take over` / `approve` / `reject` / `more info`), not a menu
choice. The only read-only owner command is `pending` (Arabic `القائمة`).

Validation before any PR: `npx tsc -b --noEmit`, `npm test`, `npm run lint`,
`npm run build`. Baseline is **110 files / 1172 tests passing**.

Changing any file under `supabase/functions/_shared/` makes the deploy script
redeploy **every** Edge Function. Changing a single function's `index.ts` does
not — PR #152 deployed exactly one.
