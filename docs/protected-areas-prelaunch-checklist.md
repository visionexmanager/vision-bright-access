# Pre-launch checklist: signed-in and admin areas

Run by a person with a **test account** (never a real customer's). Use a screen reader or at least the
keyboard for every row. Tick a row only after seeing the result, and write the failing URL and what you saw.

Public pages were already checked on 2026-10-03: `/`, `/games`, `/services`, `/library`, `/signup`, `/travel`,
`/news`, `/bazaar`, `/pricing` render with no error screen.

## 0. Setup
- [ ] Create a test user (email + password) and a second one for permission checks.
- [ ] Have one admin account. Admin pages must refuse the plain user (step 7).
- [ ] Open DevTools → Console. Ignore `adsbygoogle ... availableWidth=0`; report any other red error.

## 1. Account
- [ ] `/signup` creates an account; confirmation e-mail arrives.
- [ ] `/login` works; wrong password shows a clear, announced error.
- [ ] `/forgot-password` → mail → `/reset-password` sets a new password.
- [ ] Sign out, then open `/academy`: you land on `/login?returnTo=/academy`, and after login you return to `/academy`.
- [ ] `/profile` and `/settings` save a change and keep it after reload.
- [ ] `/data-deletion` page explains the process (do not submit with a real account).

## 2. Signed-in user areas
- [ ] `/dashboard` loads without an empty or error state.
- [ ] `/academy`: open a course, start a lesson, finish it; XP / progress updates.
- [ ] `/messages` opens; send a message between the two test users; it arrives.
- [ ] `/wishlist` add and remove an item.
- [ ] `/leaderboard` shows rows.
- [ ] `/coins-store` and `/pricing`: the plan and VX numbers look right. **Do not pay.**
- [ ] `/kids` section opens; one game starts, ends and saves a score.
- [ ] `/games`: play two different games with the keyboard only; sound has a mute control.
- [ ] `/library`: search, open a book, saved shelf works; read-aloud asks for an account when signed out.
- [ ] `/services`: open three different services; each submits a request or says clearly why it cannot.
- [ ] `/travel`: filing a request reaches the travel desk (confirmation shown).
- [ ] `/bazaar` and `/marketplace`: browse, add to cart; stop before payment.
- [ ] `/finance`, `/business-simulator`, `/professional-tools`: each opens and one action works.

## 3. Assistive technology (do these last, they find the most)
- [ ] NVDA or VoiceOver reads the page title and the main landmark on `/`, `/login`, `/services`.
- [ ] Tab order is logical; focus is always visible; a dialog traps focus and Esc closes it.
- [ ] Switch language to Arabic: layout flips (RTL), no English left over on the pages above.
- [ ] Zoom to 200%: nothing is cut off; mobile width 375px works.

## 4. Paid / sensitive flows (inspect only)
- [ ] Plan page shows plans; no one is charged by pressing a button without a clear confirmation step.
- [ ] A free user cannot open a paid-only feature (expect an upgrade message, not an error).
- [ ] VX balance changes only after a real action, never after reloading a page.

## 5. Features that depend on keys (expected state today)
| Feature | Expected |
| --- | --- |
| Video Studio and `/video` | **Unavailable** until `LUMA_API_KEY` is set (decide: set it, or hide the section) |
| Voice cloning | Works (Mistral Voxtral); ElevenLabs is intentionally off |
| Map "near me" and pin naming | Works through the fallback sources; Nominatim/Overpass direct return 403/406 |
| Social publishing | Nothing connected; the connect step happens in a browser |

## 6. WhatsApp (from a number that has never used the assistant)
- [ ] First message gets a reply; "help" shows the menu.
- [ ] One question gets an answer; one file or image request returns a usable attachment or link.

## 7. Admin (admin account only; every row must also be refused for the plain user)
- [ ] `/admin` opens; a plain user is redirected or refused.
- [ ] `/admin/users`, `/admin/moderation`, `/admin/subscribers`, `/admin/analytics`, `/admin/logs` load data.
- [ ] `/admin/products`, `/admin/bazaar`, `/admin/news`, `/admin/content` can open an item (do not publish test data).
- [ ] `/admin/vx`, `/admin/vx-pricing`, `/admin/vx-coin-orders`, `/admin/subscription-orders` open; billing stays disabled.
- [ ] `/admin/control-center` and `/admin/infra` open and show health.
- [ ] `/library/admin`, `/library/import-review`, `/library/collections-admin` open.
- [ ] `/services/ai-media-studio/provider-hub` and `/diagnostics` open (admin only).

## Report format
`URL — what you did — what you expected — what happened — screenshot/console text`.
Send it back as a list; each failure becomes one fix.
