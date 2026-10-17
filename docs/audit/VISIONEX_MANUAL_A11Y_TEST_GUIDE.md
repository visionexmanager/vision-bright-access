# Manual screen-reader and keyboard test guide

Purpose: the checks automation cannot do. Run before releases that touch navigation, forms, dialogs or any page in the table below. About 45 minutes per pass. Record results in the PR; do not mark an item passed unless someone did it.

## Setup
| Platform | Tool | Browser | Notes |
|---|---|---|---|
| Windows | NVDA (free) latest; JAWS if available | Firefox and Chrome | Browse mode and focus mode both |
| macOS | VoiceOver (⌘F5) | Safari | Quick Nav on; Rotor (VO+U) for headings/landmarks/forms |
| Android | TalkBack | Chrome | Swipe navigation + explore by touch |
| iOS | VoiceOver | Safari | Rotor via two-finger twist |
Use a clean profile, English first, then Arabic (RTL) and one other locale. Test production pages signed out; use a test account for signed-in pages — never a real user's.

## Pages (minimum)
`/`, `/signup`, `/login`, `/reset-password`, `/pricing`, `/services`, `/library`, `/bazaar`, `/academy` (signed in), one arcade game, `/contact-us`.

## Keyboard-only (no screen reader), every page
1. Tab from the address bar: first stop is a visible **Skip to content** link; Enter moves focus to main.
2. Tab through the whole page: order matches visual order; nothing unreachable; no keyboard trap; focus indicator always visible (≥3:1).
3. Every control works with Enter/Space; menus and dropdowns open with Enter/Space/Arrow and close with Esc, returning focus to the trigger.
4. Dialogs: focus moves in, is trapped, Esc closes, focus returns to the opener.
5. No action requires hover, drag or pointer only.
6. Zoom to 200% and 400%: no horizontal scroll, no clipped controls.

## Screen reader, per page
1. Page title is unique and describes the page; announced on load/route change.
2. Landmarks (banner, navigation, main, contentinfo) present once, labelled when repeated; footer `nav` regions have distinct names.
3. Exactly one `h1`; heading levels do not skip; the headings list reads as an outline.
4. Links/buttons: name says purpose out of context ("Read more" repeated = fail); icon-only buttons have names.
5. Images: informative ones described, decorative ones silent.
6. Forms (`/signup`, `/login`, `/reset-password`, `/contact-us`, Bazaar filters): every field has a label announced with its type and required state; **submit with an error and with a breached password**: the message is announced automatically (role=alert) and focus/virtual cursor can find it; `aria-invalid` and `aria-describedby` point to it.
7. Status changes (toasts, loading, results counts, language switch) are announced without moving focus.
8. Lists and tables are announced as such with sensible headers; carousels (Bazaar shops) have a keyboard-operable, announced alternative.
9. Language switch: `lang` and `dir` update; the screen reader switches voice; RTL reading order is correct.
10. Time-based or auto-updating content can be paused.

## Record
Date · tester · AT + version + browser · page · pass/fail per numbered step · defect link. Any fail on steps 1, 6 or 7 blocks the release.
