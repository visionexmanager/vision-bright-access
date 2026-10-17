# UX and accessibility report — 2026-10-17

Method: axe-core 4.10.2 (WCAG 2.0/2.1/2.2 A and AA tags) run against production pages in the in-app browser, public pages only, nothing submitted. Automated checks catch only part of WCAG; **no manual NVDA/JAWS/VoiceOver/TalkBack run was done** and no keyboard-only walkthrough was done, so screen-reader behaviour is unverified.

## Results before the fixes (production)
| Route | Violations (axe) |
|---|---|
| `/`, `/services`, `/library`, `/login`, `/signup`, `/pricing`, `/community`, `/travel`, `/contact-us`, `/privacy-policy`, `/arcade` | `color-contrast` (serious), 12–73 nodes each |
| `/bazaar` | `color-contrast`, **`select-name` (critical, 2)**, `nested-interactive` (serious, 1) |
| `/academy` | redirects to `/login` when signed out (gated by design) |

Every route has exactly one `h1`; the home page has a `main` landmark, a skip link, `lang="en"`, `dir="ltr"`, no images without `alt`. No console errors on `/`.

## Fixed in this PR
1. **Primary teal text/buttons** were `#1c8779`: 4.38:1 on white, 4.11:1 on the light section background, 3.83:1 on the tinted badge background (AA needs 4.5:1). `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` moved from `172 66% 32%` to `172 66% 28%` (≥4.73:1 on all four backgrounds, white-on-primary 5.40:1). Same hue, slightly deeper. Test: `primary-colour-contrast.test.ts` (fails on the old value).
2. **Footer group headings** `text-foreground/50` (3.28:1) → `text-muted-foreground`.
3. **Bazaar**: ten `<select>` elements now have accessible names (shop size/country filters, product filters, product form, review rating, dispute reason, create-shop country). Test: `bazaar-select-labels.test.ts` (fails on the old source). Labels are English, matching that page's existing hard-coded English labels; they are not yet in the 20 locale dictionaries.

## Not fixed (residual)
- One `#898e97` on white (3.29:1) 12px text node remains on several pages; source not located.
- `/bazaar` shop card: a clickable `div` contains interactive children (`nested-interactive`).
- Dark and high-contrast themes were not audited. After deploy, re-run axe: the contrast fixes are verified only by the unit test until then.
- Not exercised: RTL rendering, non-English locales, forms, dialogs, focus management, 200% zoom, reduced motion.
