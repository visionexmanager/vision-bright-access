// 20261097 — sign-up from a chat, executed in PGlite.
//
//   npm i --no-save @electric-sql/pglite
//   node scripts/sql/chat-signup-scenarios.mjs
//
// Runs the migration twice over minimal stubs and drives every function with
// real calls: the happy paths for a new and an existing address, and the
// negative ones that matter — a channel that never saw the code must not end up
// linked, a bind must not attach a channel to an unrelated account, the
// throttles hold, and the grants are service-role only. Exit status 1 on failure.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text,
    email_confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.whatsapp_identities (
    wa_phone text PRIMARY KEY, user_id uuid, verified_at timestamptz, pending_user_id uuid,
    pending_email text, code_hash text, code_expires_at timestamptz, attempts smallint NOT NULL DEFAULT 0,
    last_sent_at timestamptz, sends_in_window smallint NOT NULL DEFAULT 0, window_started_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.ai_subscription_gate_notices (channel text, subject text, notified_at timestamptz DEFAULT now());
  -- Stand-in for the real gate: entitled exactly when a user id is passed.
  CREATE FUNCTION public.ai_subscription_gate(_channel text, _subject text, _user_id uuid DEFAULT NULL)
    RETURNS text LANGUAGE sql AS $$ SELECT CASE WHEN _user_id IS NULL THEN 'blocked_first_notice' ELSE 'authorized' END $$;
`);

const sql = readFileSync("supabase/migrations/20261097000000_chat_signup.sql", "utf8");
await db.exec(sql);
await db.exec(sql); // re-runnable

let fail = 0;
const expect = (label, cond) => { if (!cond) fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}`); };
const call = async (fn, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(",");
  return (await db.query(`select public.${fn}(${ph}) as v`, args)).rows[0].v;
};
const mkUser = async (email, confirmed = true, ageSql = "now()") =>
  (await db.query(`INSERT INTO auth.users (email, email_confirmed_at, created_at) VALUES ($1, ${confirmed ? "now()" : "NULL"}, ${ageSql}) RETURNING id`, [email])).rows[0].id;
const ident = async (phone) => (await db.query("select user_id from public.whatsapp_identities where wa_phone=$1", [phone])).rows[0];
const clearCooldown = (ch, sub) => db.query("update public.chat_signups set last_sent_at = now() - interval '2 minutes' where channel=$1 and subject=$2", [ch, sub]);

// ── A new address, from WhatsApp ───────────────────────────────────────────
const P = "96170111111";
const st0 = await call("chat_signup_state", "whatsapp", P);
expect("a stranger is not linked and has no step", st0.linked === false && st0.step === null);
expect("begin → started", (await call("chat_signup_begin", "whatsapp", P)) === "started");
expect("name too short is refused", (await call("chat_signup_set_name", "whatsapp", P, "a")) === "invalid");
expect("a link is not a name", (await call("chat_signup_set_name", "whatsapp", P, "http://evil.example")) === "invalid");
expect("an email is not a name", (await call("chat_signup_set_name", "whatsapp", P, "me@x.com")) === "invalid");
expect("an 81-character name is refused", (await call("chat_signup_set_name", "whatsapp", P, "x".repeat(81))) === "invalid");
expect("a code cannot be requested before a name", (await call("chat_signup_request_code", "whatsapp", P, "new@x.com", "h", 10)).status === "none");
expect("a real name is accepted", (await call("chat_signup_set_name", "whatsapp", P, "  Rana   Haddad ")) === "ok");
expect("…and whitespace is collapsed", (await db.query("select display_name from public.chat_signups where subject=$1", [P])).rows[0].display_name === "Rana Haddad");

const r1 = await call("chat_signup_request_code", "whatsapp", P, "New@X.com", "hash-ok", 10);
expect("code requested for a new address", r1.status === "sent" && r1.deliver === true);
expect("a second request inside a minute is cooled down", (await call("chat_signup_request_code", "whatsapp", P, "new@x.com", "h2", 10)).status === "cooldown");

let v = await call("chat_signup_confirm", "whatsapp", P, "wrong");
expect("wrong code → invalid with tries left", v.status === "invalid" && v.attempts_left === 4);
expect("no identity yet", (await ident(P)) === undefined);
for (let i = 0; i < 4; i++) await call("chat_signup_confirm", "whatsapp", P, "wrong");
expect("after five wrong codes the sixth attempt is locked", (await call("chat_signup_confirm", "whatsapp", P, "hash-ok")).status === "locked");
expect("a locked code cannot be used again", (await call("chat_signup_confirm", "whatsapp", P, "hash-ok")).status === "none");

// A fresh attempt that succeeds.
await call("chat_signup_begin", "whatsapp", P);
await call("chat_signup_set_name", "whatsapp", P, "Rana Haddad");
await clearCooldown("whatsapp", P);
await call("chat_signup_request_code", "whatsapp", P, "new@x.com", "hash-2", 10);
v = await call("chat_signup_confirm", "whatsapp", P, "hash-2");
expect("right code for a new address → create", v.status === "create" && v.email === "new@x.com" && v.display_name === "Rana Haddad");
expect("the account does not exist until the edge function makes it, and nothing is linked", (await ident(P)) === undefined);

const stranger = await mkUser("someone-else@x.com");
expect("bind refuses an unrelated account", (await call("chat_signup_bind", "whatsapp", P, stranger)) === "rejected");
const unconfirmed = await mkUser("new@x.com", false);
expect("bind refuses an unconfirmed account", (await call("chat_signup_bind", "whatsapp", P, unconfirmed)) === "rejected");
const old = await mkUser("new@x.com", true, "now() - interval '1 day'");
expect("bind refuses an account that was not just created", (await call("chat_signup_bind", "whatsapp", P, old)) === "rejected");
await db.query("delete from auth.users where id in ($1,$2)", [unconfirmed, old]);
const created = await mkUser("new@x.com");
expect("bind attaches the freshly created account", (await call("chat_signup_bind", "whatsapp", P, created)) === "bound");
const row = await ident(P);
expect("the number is now linked and verified", row?.user_id === created);
expect("a second bind is rejected", (await call("chat_signup_bind", "whatsapp", P, created)) === "rejected");
expect("a linked number cannot begin a sign-up", (await call("chat_signup_begin", "whatsapp", P)) === "already_linked");

// ── An address that already has an account ─────────────────────────────────
const victim = await mkUser("victim@x.com");
const A = "96170222222";
await call("chat_signup_begin", "whatsapp", A);
await call("chat_signup_set_name", "whatsapp", A, "Mallory");
const r2 = await call("chat_signup_request_code", "whatsapp", A, "victim@x.com", "hash-v", 10);
expect("an existing address gets the same status and delivery as a new one", r2.status === r1.status && r2.deliver === r1.deliver);
expect("a guess does not link anything", (await call("chat_signup_confirm", "whatsapp", A, "guess")).status === "invalid");
expect("takeover without the code: nothing linked", (await ident(A)) === undefined);
expect("takeover without the code: no account was created either", (await db.query("select count(*)::int c from auth.users where email='victim@x.com'")).rows[0].c === 1);
expect("the real code links the channel to the existing account, not a new one", (await call("chat_signup_confirm", "whatsapp", A, "hash-v")).status === "linked" && (await ident(A)).user_id === victim);

// An unconfirmed address is not an account.
const U = "96170333333";
await mkUser("pending@x.com", false);
await call("chat_signup_begin", "whatsapp", U);
await call("chat_signup_set_name", "whatsapp", U, "Pending Person");
await call("chat_signup_request_code", "whatsapp", U, "pending@x.com", "hash-u", 10);
expect("an unconfirmed address is treated as new (create), never linked", (await call("chat_signup_confirm", "whatsapp", U, "hash-u")).status === "create");

// ── Expiry, cancel, throttles ──────────────────────────────────────────────
const E = "96170444444";
await call("chat_signup_begin", "whatsapp", E);
await call("chat_signup_set_name", "whatsapp", E, "Expiry Test");
await call("chat_signup_request_code", "whatsapp", E, "exp@x.com", "hash-e", 10);
await db.query("update public.chat_signups set code_expires_at = now() - interval '1 minute' where subject=$1", [E]);
expect("an expired code is refused", (await call("chat_signup_confirm", "whatsapp", E, "hash-e")).status === "expired");

await call("chat_signup_begin", "whatsapp", E);
await call("chat_signup_cancel", "whatsapp", E);
expect("cancel returns the sender to idle", (await call("chat_signup_state", "whatsapp", E)).step === null);

const T = "96170555555";
let began = [];
for (let i = 0; i < 7; i++) began.push(await call("chat_signup_begin", "whatsapp", T));
expect("begin is throttled after six in an hour (cancel does not reset it)", began.slice(0, 6).every((x) => x === "started") && began[6] === "throttled");

for (let i = 0; i < 3; i++) {
  const s = `9617066000${i}`;
  await call("chat_signup_begin", "whatsapp", s);
  await call("chat_signup_set_name", "whatsapp", s, "Spam Bot");
  await call("chat_signup_request_code", "whatsapp", s, "bombed@x.com", `h${i}`, 10);
}
const s4 = "96170669999";
await call("chat_signup_begin", "whatsapp", s4);
await call("chat_signup_set_name", "whatsapp", s4, "Spam Bot");
expect("a fourth chat cannot mail the same address within the hour", (await call("chat_signup_request_code", "whatsapp", s4, "bombed@x.com", "h9", 10)).status === "throttled");

const W = "96170777777";
await call("chat_signup_begin", "whatsapp", W);
await call("chat_signup_set_name", "whatsapp", W, "Window Test");
let last;
for (let i = 0; i < 6; i++) {
  await clearCooldown("whatsapp", W);
  last = await call("chat_signup_request_code", "whatsapp", W, `w${i}@x.com`, `hw${i}`, 10);
}
expect("five code sends an hour per chat, the sixth is throttled", last.status === "throttled");

// ── Messenger ──────────────────────────────────────────────────────────────
const M = "facebook:555000111";
expect("a Messenger sender is not entitled before linking", (await call("ai_subscription_gate_meta", M)) === "blocked_first_notice");
await call("chat_signup_begin", "meta", M);
await call("chat_signup_set_name", "meta", M, "Messenger Person");
await call("chat_signup_request_code", "meta", M, "msg@x.com", "hash-m", 10);
expect("Messenger: right code → create", (await call("chat_signup_confirm", "meta", M, "hash-m")).status === "create");
const mu = await mkUser("msg@x.com");
expect("Messenger: bind links the sender", (await call("chat_signup_bind", "meta", M, mu)) === "bound");
expect("the gate now resolves the linked account", (await call("ai_subscription_gate_meta", M)) === "authorized");
expect("another sender is still not entitled", (await call("ai_subscription_gate_meta", "facebook:999")) === "blocked_first_notice");
expect("an unknown channel is refused", await db.query("select public.chat_signup_begin('sms','x')").then(() => false, () => true));

// ── Free-reply flood guard
let allowed = [];
for (let i = 0; i < 22; i++) allowed.push(await call("chat_free_reply_allow", "whatsapp", "96170888888"));
expect("free replies: 20 an hour, then refused", allowed.slice(0, 20).every(Boolean) && !allowed[20] && !allowed[21]);
expect("free replies: another sender is unaffected", (await call("chat_free_reply_allow", "whatsapp", "96170999999")) === true);
expect("free replies: unknown channel refused", (await call("chat_free_reply_allow", "sms", "x")) === false);
await db.query("update public.chat_free_replies set window_start = now() - interval '1 hour' - interval '1 minute' where subject=$1", ["96170888888"]);
expect("free replies: the window resets after an hour", (await call("chat_free_reply_allow", "whatsapp", "96170888888")) === true);

// ── Grants ─────────────────────────────────────────────────────────────────
const can = async (role, sig) =>
  (await db.query("select has_function_privilege($1, $2, 'EXECUTE') as ok", [role, sig])).rows[0].ok;
for (const sig of [
  "public.chat_signup_state(text,text)", "public.chat_signup_begin(text,text)", "public.chat_signup_set_name(text,text,text)",
  "public.chat_signup_request_code(text,text,text,text,integer)", "public.chat_signup_confirm(text,text,text)",
  "public.chat_signup_bind(text,text,uuid)", "public.chat_signup_cancel(text,text)", "public.chat_free_reply_allow(text,text)",
]) {
  expect(`${sig}: service_role yes, anon/authenticated no`,
    (await can("service_role", sig)) && !(await can("anon", sig)) && !(await can("authenticated", sig)));
}
expect("the internal binder is callable by nobody", !(await can("service_role", "public.chat_bind_identity(text,text,uuid)")) && !(await can("anon", "public.chat_bind_identity(text,text,uuid)")));
const rls = (await db.query("select relname, relrowsecurity from pg_class where relname in ('chat_signups','meta_identities')")).rows;
expect("both tables have RLS on", rls.length === 2 && rls.every((r) => r.relrowsecurity));
expect("and no policy (service-role only)", (await db.query("select count(*)::int c from pg_policies where tablename in ('chat_signups','meta_identities')")).rows[0].c === 0);

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
