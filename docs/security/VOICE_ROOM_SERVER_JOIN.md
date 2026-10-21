# Voice rooms: the server decides the password, the seats and the price

Follow-up to findings L1–L3 of `POST_DEPLOYMENT_LIMITS_AND_AUTH_AUDIT.md` (PR #476). Migration
`20261085000000_voice_room_server_join.sql`, `livekit-token`, and `src/pages/community/VoiceRoom.tsx`.

**Not merged, not deployed, no migration applied to production.** Production holds 0 voice rooms and 0 Kids
rooms (read-only count, 2026-10-21), so no password, price or capacity limit exists there yet.

## The problem

| What | Before |
|---|---|
| Room password | stored in plain text in `voice_rooms.room_password`; `SELECT` granted to `anon` and `authenticated`; the active-room policy made it readable by any visitor; compared in the page |
| Join price (`join_cost_vx`) | charged by the page (`spendVX`); `livekit-token` ignored it |
| Capacity (`max_users`) | used only to grey out a button in the lobby |
| Membership | a `voice_room_members` row any signed-in user can insert for themselves, so it proved nothing |

A direct call to `livekit-token` with a room id skipped all of it.

## What it does now

1. **The password is never stored readable.** A trigger on `voice_rooms` and `kids_voice_rooms` takes whatever an
   owner writes to `room_password`, stores a bcrypt hash (pgcrypto, per-password salt) in `voice_room_secrets`,
   blanks the column, and sets a readable `has_password` flag. The owner's write path is unchanged. Existing
   plain-text passwords are hashed in place by the migration (none in production).
2. **`voice_room_join(user, room, kind, password, listener, is_admin)`** (service role only), called by
   `livekit-token` before it signs anything. Under a lock on the room row it:
   - lets the owner and admins in with no password, price or capacity;
   - checks the password when the room has one and this user has not already given the current one. A changed
     password makes members give the new one. Five wrong guesses per user per room, or fifty per room, in ten
     minutes answer `too_many_attempts`, even for the right password;
   - checks capacity: members whose heartbeat is under 90 seconds old (the page beats every 30), never counting the
     joiner. `max_users` of 999 or more, or `NULL`, means no limit;
   - charges `join_cost_vx` once per user and room, writing the same two rows as `spend_vx`
     (`user_points` and `vx_purchases`), under a per-user lock so two rooms cannot overdraw one balance;
   - records the join in `voice_room_joins` and upserts the membership row, atomically with the decision.
3. **`livekit-token`** takes the user from the verified session, passes the room, kind, password (bounded to 128
   characters, never logged or echoed) and the listener flag, and maps the answer: `password_required`,
   `wrong_password` (403), `too_many_attempts` (429), `room_full` (409), `insufficient_vx` (402),
   `room_not_found` (404). If the database cannot answer it returns 503 and signs nothing. It also checks that
   LiveKit credentials exist before the join, so nobody is charged for a token that cannot be signed.
4. **The page** no longer reads or compares the password, no longer charges the price, and no longer writes its own
   membership row. It asks for a token, opens the password dialog when the server says one is needed, and shows
   the existing messages for a wrong password, a full room and too little VX. No new text, so no translation changes.

Kids rooms get the password and the secrets handling only. They have no price, and their member table has no
heartbeat, so no capacity check.

## Behaviour changes

- A room with a password asks for it from anyone who has not given the current one, including a member who joined
  before a password was set.
- A paid room charges when the token is requested, not before the dialog. A member who paid once rejoins free.
- Joining a full room now fails at the server; someone whose tab was backgrounded for 90 seconds may lose their
  seat to a newcomer and be told the room is full on reconnect.
- An old copy of the page (cached during the deploy) sees `has_password` as missing, asks for no password, and is
  told `password_required` by the server: it fails closed with the generic token error until it reloads.

## Verification

| Check | Result |
|---|---|
| `scripts/sql/voice-room-join-scenarios.mjs` (real PostgreSQL 18.4, 12 connections) | all passed: hashing, backfill, privileges, password flow and change, throttle, capacity (including 15 races), once-only price (including 12 simultaneous joins and a four-room overdraft race), Kids, room deletion |
| Mutation proofs | without the room lock the capacity, double-charge and throttle races fail; without the per-user advisory lock the overdraft race fails |
| `scripts/e2e/livekit-gate-harness.ts` | all passed; the previous handler fails 19 of its checks |
| `src/test/voice-room-join.test.ts` | wiring: grants, lock, search_path, no plan or price change, token order, page no longer charges or compares |
| tsc, ESLint, `deno check livekit-token` | clean |

Both new database and harness scripts need a workflow step to run in CI; editing `.github/workflows/*` needs
your approval and was not done.

## Rollout and rollback

Deploy order is the migration, then `livekit-token`, then the page (the normal Deploy does all three together).
If the function ships before the migration, joins fail closed (`join_unavailable`, 503).

Rollback: restore the previous `livekit-token` and page (the old flow works against the new schema, except that
passwords already hashed can no longer be read back), then drop `voice_room_join`, the four triggers and the three
tables. A password that was hashed cannot be recovered, by design; owners set it again.

## Not covered (found while doing this, not fixed)

- **Room creation fee and creator-set price.** `Community.tsx` charges the creation fee in the page and inserts
  the room with a `join_cost_vx`, `max_users` and `cost_vx` it chose; a direct insert skips the fee. The RLS
  insert policy has no price check. A separate fix, and a product decision on who may set a price.
- **Who may publish.** The token grants publish rights to everyone; listener and stage modes are page settings.
- **No password-setting screen exists** in the page (no code writes `room_password`), so passwords can only be
  set through the API today. The enforcement is ready for when the screen is built.
- **Minutes and provider billing** are unchanged: no cap, no usage record, provider budget unverified.
