# RADIUS and the PI integration

## What is known
PI/Proradius manages RADIUS (it has NAS management, `restart-radius`, FUP/quota counters, session lists, and
the permission `console.disconnect_users`). Which RADIUS server and database sit under it is **unknown** — it
cannot be seen from the browser side, so this service does not talk to RADIUS or its database at all. It
talks to PI's API only, which keeps PI's billing/expiry/provisioning logic the single source of truth.

## `RadiusProvider` (src/providers/types.ts)
`getUser`, `getUserStatus`, `getActiveSessions`, `enableUser`, `disableUser`, `disconnectSession`.
`authenticateUser` and `updateUser` are deliberately **not** present — nothing supports them.

| Method | PI call | State |
| --- | --- | --- |
| getUser / getUserStatus | `GET /api/user/` + `GET /api/sessions/list` | paths known; params/shape **unverified** |
| getActiveSessions | `GET /api/sessions/list` | unverified; NAS addresses are dropped in the mapper |
| enableUser / disableUser / disconnectSession | `POST /api/user/bulk/actions/` (inactivate / disconnect permission names known) | **payload unknown → NotSupported** until a template is supplied |

## Closing the gaps
1. **Shapes:** `PI_BASE_URL=… PI_USERNAME=… PI_PASSWORD=… npm run pi:probe -- <test-username>` prints the
   *structure* of each read response (keys and types, no values). Adjust `src/providers/pi/mapper.ts` and the
   parameter names in `PI_CONTRACT` (`provider.ts`), then add the shape to the tests.
2. **Writes:** perform the action once in the PI UI on a **test account** with browser dev tools open, and
   record the request (method, path, JSON body). Save as the file named by `PI_ACTIONS_FILE`:

```json
{
  "DISABLE": { "method": "POST", "path": "/api/user/bulk/actions/", "body": { "action": "<captured>", "users": ["$username"] } },
  "ENABLE":  { "method": "POST", "path": "/api/user/bulk/actions/", "body": { "action": "<captured>", "users": ["$username"] } }
}
```

   Only `$username` and `$customerId` are substituted; `path` must start with `/api/`; unknown keys are rejected.
   The file is operator-supplied configuration (keep it outside Git if it contains anything account-specific).

## Safety properties
* A record is accepted only if it is the one requested (id or username matches).
* Status that cannot be recognised is `UNKNOWN`; the action engine refuses to act on `UNKNOWN`.
* Every write is verified by a fresh read-back; a PI success response alone is not trusted.
* Writes are blocked unless `ENABLE_RADIUS_WRITE` **and** the specific flag are on **and** the kill switch is off.
* `TERMINATE` is never executed (no provider method; flag off).
