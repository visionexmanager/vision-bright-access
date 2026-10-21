// The server-side voice room join (migration 20261085) on a REAL Postgres server with many
// connections: password hashing, throttling, capacity, the one-time price, and the races between them.
//
//   npm i --no-save embedded-postgres pg
//   node scripts/sql/voice-room-join-scenarios.mjs
//
// The room, member, points and purchase tables are minimal copies of the production shapes (same
// columns the function reads and writes). Writes only to a throwaway database. Ends with a mutation
// proof: without the room row lock the capacity race oversells. Exit status 1 on any failure.
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MIGRATION = process.env.VJ_MIGRATION ?? "supabase/migrations/20261085000000_voice_room_server_join.sql";
const sql = readFileSync(MIGRATION, "utf8");

const SCHEMA = `
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE TABLE public.voice_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, room_name text NOT NULL DEFAULT 'room',
    max_users integer NOT NULL DEFAULT 4, join_cost_vx integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
    is_private boolean NOT NULL DEFAULT false, room_password text, updated_at timestamptz DEFAULT now());
  CREATE TABLE public.kids_voice_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, room_name text NOT NULL DEFAULT 'kids room',
    max_users integer NOT NULL DEFAULT 12, is_private boolean NOT NULL DEFAULT false, room_password text, status text NOT NULL DEFAULT 'live');
  CREATE TABLE public.voice_room_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL, joined_at timestamptz NOT NULL DEFAULT now(), raise_hand boolean NOT NULL DEFAULT false,
    is_listener boolean NOT NULL DEFAULT false, is_on_stage boolean NOT NULL DEFAULT false, raised_at timestamptz,
    last_seen_at timestamptz NOT NULL DEFAULT now(), UNIQUE (room_id, user_id));
  CREATE TABLE public.user_points (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, points integer NOT NULL,
    reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.vx_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, amount integer NOT NULL,
    item_type text NOT NULL, item_id text, item_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  GRANT SELECT ON public.voice_rooms, public.kids_voice_rooms TO anon, authenticated;
`;

const dir = mkdtempSync(join(tmpdir(), "vj-pg-"));
const server = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "pw", port: 54393, persistent: false, onLog: () => {}, onError: () => {}, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
await server.initialise();
await server.start();

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const connect = async (role) => {
  const c = new pg.Client({ host: "127.0.0.1", port: 54393, user: "postgres", password: "pw", database: "postgres" });
  await c.connect();
  if (role) await c.query(`SET ROLE ${role}`);
  return c;
};

try {
  const admin = await connect();
  await admin.query(SCHEMA);
  for (let i = 1; i <= 40; i++) await admin.query("INSERT INTO auth.users VALUES ($1)", [u(i)]);

  // Plain-text passwords that already exist when the migration lands (production has none).
  const legacy = (await admin.query("INSERT INTO public.voice_rooms (owner_id, room_password) VALUES ($1,'legacy-secret') RETURNING id", [u(1)])).rows[0].id;
  const legacyBlank = (await admin.query("INSERT INTO public.voice_rooms (owner_id, room_password) VALUES ($1,'') RETURNING id", [u(1)])).rows[0].id;
  await admin.query(sql);
  await admin.query(sql); // re-runnable
  console.log(`real PostgreSQL ${(await admin.query("show server_version")).rows[0].server_version}, migration applied twice`);

  const room = async (extra = {}) => {
    const cols = { owner_id: u(1), ...extra };
    const keys = Object.keys(cols);
    const r = await admin.query(`INSERT INTO public.voice_rooms (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, keys.map((k) => cols[k]));
    return r.rows[0].id;
  };
  const svc = await connect("service_role");
  const join = (c, user, roomId, pw = null, kind = "adult", listener = false, isAdmin = false) =>
    c.query("select public.voice_room_join($1,$2,$3,$4,$5,$6) v", [user, roomId, kind, pw, listener, isAdmin]).then((r) => r.rows[0].v);
  const pointsOf = async (user) => Number((await admin.query("select coalesce(sum(points),0)::int s from public.user_points where user_id=$1", [user])).rows[0].s);

  // ── 1. The password is never stored readable ──
  let r = (await admin.query("select room_password, has_password from public.voice_rooms where id=$1", [legacy])).rows[0];
  expect("a plain-text password already present is blanked and flagged by the migration", r.room_password === null && r.has_password === true);
  expect("…and hashed in the server-only table (bcrypt, not the text)", (await admin.query("select password_hash h from public.voice_room_secrets where kind='adult' and room_id=$1", [legacy])).rows[0].h.startsWith("$2"));
  r = (await admin.query("select room_password, has_password from public.voice_rooms where id=$1", [legacyBlank])).rows[0];
  expect("an empty stored password becomes 'no password'", r.room_password === null && r.has_password === false);

  const pwRoom = await room({ room_password: "open-sesame" });
  r = (await admin.query("select room_password, has_password from public.voice_rooms where id=$1", [pwRoom])).rows[0];
  expect("a password written by an owner is blanked on the way in and has_password is true", r.room_password === null && r.has_password === true);
  const h1 = (await admin.query("select password_hash h from public.voice_room_secrets where room_id=$1", [pwRoom])).rows[0].h;
  await admin.query("UPDATE public.voice_rooms SET room_name = 'renamed' WHERE id=$1", [pwRoom]);
  expect("an update that does not touch the password leaves the hash alone", (await admin.query("select password_hash h from public.voice_room_secrets where room_id=$1", [pwRoom])).rows[0].h === h1);
  const anon = await connect("anon");
  expect("anon reads the room but the password column is empty", (await anon.query("select room_password, has_password from public.voice_rooms where id=$1", [pwRoom])).rows[0].room_password === null);
  let denied = 0;
  for (const t of ["voice_room_secrets", "voice_room_joins", "voice_room_join_failures"]) {
    try { await anon.query(`select * from public.${t}`); } catch { denied++; }
  }
  expect("anon cannot read the secrets, joins or failures tables", denied === 3);
  const authed = await connect("authenticated");
  denied = 0;
  for (const t of ["voice_room_secrets", "voice_room_joins", "voice_room_join_failures"]) {
    try { await authed.query(`select * from public.${t}`); } catch { denied++; }
  }
  let fnDenied = false;
  try { await authed.query("select public.voice_room_join($1,$2,'adult',null,false,false)", [u(2), pwRoom]); } catch { fnDenied = true; }
  expect("a signed-in user cannot read those tables or call voice_room_join", denied === 3 && fnDenied);

  // ── 2. Password flow ──
  expect("the owner joins with no password", (await join(svc, u(1), pwRoom)).allowed === true);
  expect("an admin joins with no password", (await join(svc, u(30), pwRoom, null, "adult", false, true)).allowed === true);
  expect("a member with no password → password_required", (await join(svc, u(2), pwRoom)).reason === "password_required");
  expect("a wrong password → wrong_password, and no membership row", (await join(svc, u(2), pwRoom, "nope")).reason === "wrong_password"
    && (await admin.query("select count(*)::int n from public.voice_room_members where room_id=$1 and user_id=$2", [pwRoom, u(2)])).rows[0].n === 0);
  expect("the right password → allowed, membership recorded", (await join(svc, u(2), pwRoom, "open-sesame")).allowed === true
    && (await admin.query("select count(*)::int n from public.voice_room_members where room_id=$1 and user_id=$2", [pwRoom, u(2)])).rows[0].n === 1);
  expect("rejoining needs no password again", (await join(svc, u(2), pwRoom)).allowed === true);
  await admin.query("UPDATE public.voice_rooms SET room_password = 'second-word' WHERE id=$1", [pwRoom]);
  expect("after the owner changes the password, the member must give the new one", (await join(svc, u(2), pwRoom)).reason === "password_required");
  expect("…and the old one no longer works", (await join(svc, u(2), pwRoom, "open-sesame")).reason === "wrong_password");
  expect("…the new one does", (await join(svc, u(2), pwRoom, "second-word")).allowed === true);
  await admin.query("UPDATE public.voice_rooms SET room_password = NULL WHERE id=$1", [pwRoom]);
  expect("clearing the password lets anyone in and drops the secret",
    (await join(svc, u(3), pwRoom)).allowed === true && (await admin.query("select count(*)::int n from public.voice_room_secrets where room_id=$1", [pwRoom])).rows[0].n === 0);

  // ── 3. Guessing is throttled ──
  const guessRoom = await room({ room_password: "tough-one" });
  const verdicts = [];
  for (let i = 0; i < 7; i++) verdicts.push((await join(svc, u(4), guessRoom, `guess-${i}`)).reason);
  expect("five wrong guesses, then too_many_attempts", verdicts.slice(0, 5).every((x) => x === "wrong_password") && verdicts.slice(5).every((x) => x === "too_many_attempts"));
  expect("…even the right password is refused while throttled", (await join(svc, u(4), guessRoom, "tough-one")).reason === "too_many_attempts");
  expect("another user is not throttled by it", (await join(svc, u(5), guessRoom, "tough-one")).allowed === true);
  await admin.query("UPDATE public.voice_room_join_failures SET at = now() - interval '11 minutes'");
  expect("the throttle lifts after ten minutes", (await join(svc, u(4), guessRoom, "tough-one")).allowed === true);

  // ── 4. Capacity ──
  const small = await room({ max_users: 2 });
  await join(svc, u(6), small); await join(svc, u(7), small);
  expect("a third person in a room of two → room_full", (await join(svc, u(8), small)).reason === "room_full");
  expect("a member already inside is not turned away at full", (await join(svc, u(6), small)).allowed === true);
  await admin.query("UPDATE public.voice_room_members SET last_seen_at = now() - interval '5 minutes' WHERE room_id=$1 AND user_id=$2", [small, u(7)]);
  expect("a member whose heartbeat is 5 minutes old no longer holds a seat", (await join(svc, u(8), small)).allowed === true);
  expect("the owner is never refused for capacity", (await join(svc, u(1), small)).allowed === true);
  const open = await room({ max_users: 999 });
  for (let i = 10; i < 20; i++) await join(svc, u(i), open);
  expect("max_users 999 means no limit", (await join(svc, u(20), open)).allowed === true);

  // ── 5. The price ──
  const paid = await room({ join_cost_vx: 50 });
  await admin.query("INSERT INTO public.user_points (user_id, points, reason) VALUES ($1, 30, 'seed'), ($2, 100, 'seed')", [u(21), u(22)]);
  expect("30 VX cannot join a 50 VX room → insufficient_vx", (await join(svc, u(21), paid)).reason === "insufficient_vx");
  expect("…and nothing was charged, recorded or joined",
    (await pointsOf(u(21))) === 30 && (await admin.query("select count(*)::int n from public.voice_room_joins where user_id=$1", [u(21)])).rows[0].n === 0);
  r = await join(svc, u(22), paid);
  expect("100 VX joins: charged 50 once", r.allowed === true && r.charged === 50 && (await pointsOf(u(22))) === 50);
  expect("the purchase is recorded like spend_vx records it", (await admin.query("select amount, item_type, item_id from public.vx_purchases where user_id=$1", [u(22)])).rows[0].item_type === "voice_room_join");
  r = await join(svc, u(22), paid);
  expect("rejoining is free", r.allowed === true && r.charged === 0 && (await pointsOf(u(22))) === 50);
  const ownerBefore = await pointsOf(u(1));
  await join(svc, u(1), paid);
  expect("the owner pays nothing", (await pointsOf(u(1))) === ownerBefore);
  await admin.query("UPDATE public.voice_rooms SET join_cost_vx = 500 WHERE id=$1", [paid]);
  expect("a later price rise does not charge someone already in", (await join(svc, u(22), paid)).charged === 0);

  // ── 6. Kids rooms: password only ──
  const kid = (await admin.query("INSERT INTO public.kids_voice_rooms (owner_id, room_password, max_users) VALUES ($1,'kidspass',1) RETURNING id", [u(1)])).rows[0].id;
  expect("a Kids room's password is hashed too", (await admin.query("select room_password, has_password from public.kids_voice_rooms where id=$1", [kid])).rows[0].room_password === null);
  expect("Kids: no password → password_required", (await join(svc, u(23), kid, null, "kids")).reason === "password_required");
  expect("Kids: wrong → wrong_password", (await join(svc, u(23), kid, "x", "kids")).reason === "wrong_password");
  expect("Kids: right → allowed", (await join(svc, u(23), kid, "kidspass", "kids")).allowed === true);
  await admin.query("UPDATE public.kids_voice_rooms SET status='ended' WHERE id=$1", [kid]);
  expect("Kids: an ended room → room_not_found", (await join(svc, u(23), kid, "kidspass", "kids")).reason === "room_not_found");
  expect("an unknown room → room_not_found", (await join(svc, u(2), "99999999-9999-4999-8999-999999999999")).reason === "room_not_found");
  await admin.query("UPDATE public.voice_rooms SET is_active=false WHERE id=$1", [small]);
  expect("an inactive room → room_not_found (the owner too)", (await join(svc, u(1), small)).reason === "room_not_found");
  expect("bad arguments → invalid", (await join(svc, null, small)).reason === "invalid" && (await join(svc, u(2), small, null, "weird")).reason === "invalid");

  // ── 7. Races, on separate connections ──
  const CONNS = 12;
  const clients = await Promise.all(Array.from({ length: CONNS }, () => connect("service_role")));
  const pids = new Set(await Promise.all(clients.map(async (c) => (await c.query("select pg_backend_pid() p")).rows[0].p)));
  expect(`${CONNS} distinct backend connections`, pids.size === CONNS);

  let oversold = 0;
  const ROUNDS = 15;
  for (let round = 0; round < ROUNDS; round++) {
    const rid = await room({ max_users: 3 });
    const out = await Promise.all(clients.map((c, i) => join(c, u(20 + i), rid)));
    const inRoom = (await admin.query("select count(*)::int n from public.voice_room_members where room_id=$1", [rid])).rows[0].n;
    if (out.filter((v) => v.allowed).length !== 3 || inRoom !== 3 || out.filter((v) => v.reason === "room_full").length !== CONNS - 3) oversold++;
  }
  expect(`${ROUNDS} rooms of 3 x ${CONNS} simultaneous joiners: exactly 3 get in, 9 are told room_full`, oversold === 0);

  await admin.query("INSERT INTO public.user_points (user_id, points, reason) VALUES ($1, 500, 'seed')", [u(31)]);
  const dbl = await room({ join_cost_vx: 50 });
  const dbo = await Promise.all(clients.map((c) => join(c, u(31), dbl)));
  expect("one user joining the same paid room 12 times at once is charged exactly once",
    dbo.every((v) => v.allowed) && dbo.filter((v) => v.charged === 50).length === 1 && (await pointsOf(u(31))) === 450
    && (await admin.query("select count(*)::int n from public.vx_purchases where user_id=$1", [u(31)])).rows[0].n === 1);

  await admin.query("INSERT INTO public.user_points (user_id, points, reason) VALUES ($1, 60, 'seed')", [u(32)]);
  const rooms2 = []; for (let i = 0; i < 4; i++) rooms2.push(await room({ join_cost_vx: 30 }));
  const ov = await Promise.all(clients.map((c, i) => join(c, u(32), rooms2[i % 4])));
  expect("60 VX across four 30 VX rooms at once pays for exactly two (no overdraft)",
    ov.filter((v) => v.charged === 30).length === 2 && (await pointsOf(u(32))) === 0);

  const guessRace = await room({ room_password: "race-word" });
  const gr = await Promise.all(clients.map((c) => join(c, u(33), guessRace, "wrong")));
  expect("12 simultaneous wrong guesses from one user: exactly 5 are answered wrong_password, the rest are throttled",
    gr.filter((v) => v.reason === "wrong_password").length === 5 && gr.filter((v) => v.reason === "too_many_attempts").length === CONNS - 5);

  // ── 8. Deleting a room drops its secrets ──
  const gone = await room({ room_password: "bye" });
  await join(svc, u(34), gone, "bye");
  await admin.query("DELETE FROM public.voice_rooms WHERE id=$1", [gone]);
  expect("deleting a room removes its secret and join records",
    (await admin.query("select count(*)::int n from public.voice_room_secrets where room_id=$1", [gone])).rows[0].n === 0
    && (await admin.query("select count(*)::int n from public.voice_room_joins where room_id=$1", [gone])).rows[0].n === 0);

  for (const c of [...clients, svc, anon, authed, admin]) await c.end().catch(() => {});
} finally {
  await server.stop().catch(() => {});
}

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
process.exit(fail ? 1 : 0);
