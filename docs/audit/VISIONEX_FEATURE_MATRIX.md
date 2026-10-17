# Feature matrix — 2026-10-17

This pass did **not** exercise features in a browser or against live backends, so nothing here is marked "verified end-to-end" by this audit. Status below = what this pass established.

| Area | Evidence this pass | Status |
|---|---|---|
| Type safety, build | typecheck 0 errors; build succeeds | Verified |
| Unit/integration suite | 6805/6815 pass under load; remaining 10 explained (9 timeouts, 1 local CRLF) | Verified (local) |
| Database RLS (static) | every created table enables RLS | Verified statically; live probe not run |
| Edge Function JWT config | lists reconciled and test-guarded | Verified statically |
| Org report export (CSV/XLSX/PDF) | CSV hardened and tested | Fixed |
| Production site, `/robots.txt`, `/sitemap.xml` | HTTP 200 | Reachable only |
| AI platform, VX/plans, Bazaar, Academy/VisionKids, Library, WhatsApp, community, admin, notifications | Covered by prior documented audits and the unit suite | Not re-verified here |
| Server/Hetzner, backups, monitoring | Not accessed | Not tested |
