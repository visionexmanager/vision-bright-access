# Feature matrix — 2026-10-17

No feature was exercised end-to-end with an account in this pass. "Verified" below means only what is stated.

| Area | Evidence this pass | Status |
|---|---|---|
| Typecheck, lint, build, unit suite | see Full audit | Verified (local + PR CI) |
| Database RLS | Live: all 629 public tables enable RLS; anonymous reads of sensitive tables denied or empty | Verified (anonymous only) |
| SECURITY DEFINER functions | Live: 539, all pin `search_path`; 9 risky-looking ones read; 1 defect fixed | Verified |
| Provider hub / AI metrics | Cost leak found and fixed | Fixed, pending deploy; live admin flow not exercised |
| Org reports (CSV/XLSX/PDF) | CSV hardened | Fixed |
| Home, services, library, login, signup, pricing, community, travel, contact, privacy, arcade | Load, one `h1`, axe run | Reachable; contrast fixed in PR |
| Bazaar | Page loads; selects labelled | Partially verified; transactions not tested |
| Academy | Redirects to login when signed out | Gated by design; not entered |
| VX wallet/plans, AI routing/metering, WhatsApp, VisionKids, Library parsing/export, notifications, admin, community, payments | Prior audits and unit suite only | Not re-verified here |
| Hetzner server, backups, monitoring | Not accessed | Not tested |
