// Runs the REAL livekit-token handler with Supabase and the network replaced, to prove who can
// be handed a LiveKit room token, for which rooms, and what the token says.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/e2e/livekit-gate-harness.ts
//
// No network request is made; the LiveKit key and secret are fake values used to sign a token
// locally, and the signed token is decoded here to check its scope. Nothing is printed except
// statuses and booleans.

// @ts-nocheck — a harness that replaces Deno.serve and fetch.

Deno.env.set("SUPABASE_URL", "http://stub.supabase.test");
Deno.env.set("SUPABASE_ANON_KEY", "stub-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service");
Deno.env.set("LIVEKIT_API_KEY", "harness-key");
Deno.env.set("LIVEKIT_API_SECRET", "harness-secret-harness-secret-harness");
Deno.env.set("LIVEKIT_URL", "wss://livekit.stub.test");

const USER = "00000000-0000-4000-8000-0000000000b1";
const ROOM = "11111111-1111-4111-8111-111111111111";
const KIDS_ROOM = "22222222-2222-4222-8222-222222222222";

let handler: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { handler = h; return { finished: Promise.resolve(), shutdown() {} }; };

let entitled: boolean | "error" = true;
let room: any = { id: ROOM, is_active: true };
let kidsRoom: any = { id: KIDS_ROOM, status: "live" };
let banned = false;
let kidsBanned = false;
let admin = false;
let profileName: string | null = "Sam Member";
let joinVerdict: unknown = { allowed: true, charged: 0 };
let joinFails = false;
let joinArgs: any = null;
let rpcs: string[] = [];
let reads: string[] = [];
let outside: string[] = [];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input: Request | string | URL, init?: RequestInit) => {
  const req = input instanceof Request ? input : new Request(String(input), init);
  const url = new URL(req.url);
  if (url.hostname !== "stub.supabase.test") { outside.push(url.hostname); return json({ error: "blocked" }, 599); }
  if (url.pathname === "/auth/v1/user") return json({ id: USER, aud: "authenticated", role: "authenticated", email: "private.address@example.test", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const name = url.pathname.split("/").pop()!;
    rpcs.push(name);
    if (name === "ai_user_entitled") return entitled === "error" ? json({ code: "XX000", message: "down" }, 500) : json(entitled);
    if (name === "has_role") return json(admin);
    if (name === "voice_room_join") {
      joinArgs = JSON.parse(await req.clone().text());
      return joinFails ? json({ code: "XX000", message: "down" }, 500) : json(joinVerdict);
    }
    return json(null);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const table = url.pathname.split("/").pop()!;
    reads.push(table);
    const single = (req.headers.get("accept") ?? "").includes("vnd.pgrst.object");
    const none = single ? json({ code: "PGRST116", message: "0 rows" }, 406) : json([]);
    const one = (row: any) => (row ? (single ? json(row) : json([row])) : none);
    if (table === "voice_rooms") return one(room && url.search.includes(`id=eq.${room.id}`) ? room : null);
    if (table === "kids_voice_rooms") return one(kidsRoom && url.search.includes(`id=eq.${kidsRoom.id}`) ? kidsRoom : null);
    if (table === "voice_room_bans") return one(banned ? { id: "b1" } : null);
    if (table === "kids_voice_room_bans") return one(kidsBanned ? { user_id: USER } : null);
    if (table === "profiles") return one(profileName ? { display_name: profileName } : null);
    return none;
  }
  return json({}, 404);
};

await import("../../supabase/functions/livekit-token/index.ts");
if (!handler) throw new Error("no handler registered");

let fail = 0;
const check = (label: string, ok: boolean) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}`); };
async function call(body: unknown = { roomId: ROOM, userName: "Harness" }, auth = true, raw?: string) {
  rpcs = []; reads = []; outside = []; joinArgs = null;
  const res = await handler!(new Request("http://localhost/functions/v1/livekit-token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://visionex.app", ...(auth ? { Authorization: "Bearer harness-user" } : {}) },
    body: raw ?? JSON.stringify(body),
  }));
  let b: any = null; try { b = JSON.parse(await res.text()); } catch { /* not json */ }
  return { status: res.status, body: b };
}
const decode = (jwt: string) => JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

// ── Plan states (what ai_user_entitled answers for each is proven in the database scenarios) ──
const STATES: [string, boolean | "error", number, boolean][] = [
  ["free week", false, 403, false],
  ["expired subscription", false, 403, false],
  ["no plan", false, 403, false],
  ["Kids, active", true, 200, true],
  ["Basic/Pro/Business, active", true, 200, true],
  ["admin", true, 200, true],
  ["plan lookup failing", "error", 503, false],
];
let r: { status: number; body: any };
for (const [label, answer, status, token] of STATES) {
  entitled = answer;
  r = await call();
  check(`${label} → ${status}${token ? " with a signed token" : " and no token"}`,
    r.status === status && (token ? typeof r.body?.token === "string" && r.body.token.split(".").length === 3 : !r.body?.token));
  check(`${label}: the plan was asked server-side before anything was signed`, rpcs.includes("ai_user_entitled"));
}
entitled = false;
r = await call();
check("a refusal names no vendor, no price and no plan the caller is on", r.status === 403 && !/livekit|price|usd|free_trial|basic|business/i.test(JSON.stringify(r.body)));
check("a refused plan reads no room table (nothing is looked up for an ineligible caller)", reads.length === 0);

// ── Request shape: parsed only after the plan, and strictly ──
entitled = true;
r = await call(null, true, "{not json");
check("a malformed body from a paying account → 400, no token", r.status === 400 && !r.body?.token);
for (const bad of [undefined, "", "room-1", "x".repeat(300), "../etc", `${ROOM}-extra`, `kids-room-1`, 123, null, ["a"]]) {
  r = await call({ roomId: bad });
  check(`roomId ${JSON.stringify(bad)?.slice(0, 24)} → 400 invalid_room, no token`, r.status === 400 && r.body?.error === "invalid_room" && !r.body?.token);
}
r = await call({ roomId: ROOM }, false);
check("no Authorization header → 401 before any plan or room lookup", r.status === 401 && rpcs.length === 0 && reads.length === 0);

// ── Room isolation ──
room = { id: ROOM, is_active: true };
r = await call({ roomId: ROOM });
check("an existing active room → 200 with a token", r.status === 200 && !!r.body?.token);
const claims = r.body?.token ? decode(r.body.token) : {};
check("the token is for exactly that room, for the verified user id, with room-join only", claims?.video?.room === ROOM && claims?.sub === USER && claims?.video?.roomJoin === true && !claims?.video?.roomAdmin && !claims?.video?.roomCreate && !claims?.video?.roomList);
check("the token expires within two hours", claims?.exp - claims?.nbf <= 7200 && claims?.exp - claims?.nbf > 0);
check("the participant name is the account's display name, not the name the browser sent", claims?.name === "Sam Member");
room = null;
r = await call({ roomId: ROOM });
check("a well-formed id that is not a room → 404, no token (no room is created by naming it)", r.status === 404 && !r.body?.token);
room = { id: "99999999-9999-4999-8999-999999999999", is_active: true };
r = await call({ roomId: ROOM });
check("a different room's row is never used for this id", r.status === 404 && !r.body?.token);
room = { id: ROOM, is_active: false };
r = await call({ roomId: ROOM });
check("an inactive room → 404 for an ordinary member", r.status === 404 && !r.body?.token);
admin = true;
r = await call({ roomId: ROOM });
check("…and still joinable by a verified admin", r.status === 200 && !!r.body?.token);
admin = false;
room = { id: ROOM, is_active: true };
banned = true;
r = await call({ roomId: ROOM });
check("a user banned from the room → 403 banned, no token", r.status === 403 && r.body?.error === "banned" && !r.body?.token);
banned = false;

// ── Kids rooms ──
r = await call({ roomId: `kids-${KIDS_ROOM}` });
const kc = r.body?.token ? decode(r.body.token) : {};
check("a live Kids room, by the 'kids-' name the Kids app uses → 200, token scoped to that name", r.status === 200 && kc?.video?.room === `kids-${KIDS_ROOM}`);
kidsRoom = { id: KIDS_ROOM, status: "ended" };
r = await call({ roomId: `kids-${KIDS_ROOM}` });
check("an ended Kids room → 404, no token", r.status === 404 && !r.body?.token);
kidsRoom = { id: KIDS_ROOM, status: "live" };
kidsBanned = true;
r = await call({ roomId: `kids-${KIDS_ROOM}` });
check("banned from a Kids room → 403, no token", r.status === 403 && !r.body?.token);
kidsBanned = false;
r = await call({ roomId: `kids-${ROOM}` });
check("a 'kids-' name for a room that is not a Kids room → 404, no token (an adult room id cannot be reached through the Kids prefix)", r.status === 404 && !r.body?.token);

// ── Names ──
profileName = null;
r = await call({ roomId: ROOM, userName: "private.address@example.test" });
check("no profile name and an e-mail address supplied → the name is 'Member', the address never appears in the token", !!r.body?.token && decode(r.body.token).name === "Member" && !JSON.stringify(decode(r.body.token)).includes("@"));
r = await call({ roomId: ROOM, userName: "Alex\n\u0000 Doe".repeat(30) });
check("a long, control-character name from the browser is cleaned and cut to 40 characters", !!r.body?.token && decode(r.body.token).name.length <= 40 && ![...decode(r.body.token).name].some((ch: string) => ch.charCodeAt(0) < 32));
profileName = "Sam Member";
r = await call({ roomId: ROOM, userName: "Visionex Admin" });
check("a browser-supplied name cannot override the account's display name", decode(r.body.token).name === "Sam Member");
check("no request left the process", outside.length === 0);

// ── The password, the capacity and the price are decided by voice_room_join (migration 20261085) ──
entitled = true; admin = false; room = { id: ROOM, is_active: true }; kidsRoom = { id: KIDS_ROOM, status: "live" }; banned = false; kidsBanned = false;
joinVerdict = { allowed: true, charged: 0 };
r = await call({ roomId: ROOM, password: "open-sesame", listener: true });
check("a token is signed only after voice_room_join said yes, and the join carried the verified user, room and password",
  r.status === 200 && !!r.body?.token && joinArgs?._user_id === USER && joinArgs?._room_id === ROOM && joinArgs?._kind === "adult" && joinArgs?._password === "open-sesame" && joinArgs?._listener === true && joinArgs?._is_admin === false);
r = await call({ roomId: ROOM, userId: "00000000-0000-4000-8000-0000000000ff" });
check("a user id sent by the browser is never used for the join", joinArgs?._user_id === USER);
r = await call({ roomId: ROOM });
check("no password supplied → the function passes null, not an empty string", joinArgs?._password === null);
r = await call({ roomId: `kids-${KIDS_ROOM}`, password: "kidspass" });
check("a Kids room is joined with kind 'kids' and the bare room id", r.status === 200 && joinArgs?._kind === "kids" && joinArgs?._room_id === KIDS_ROOM && joinArgs?._password === "kidspass");
admin = true;
r = await call({ roomId: ROOM });
check("an admin is flagged to the join (the database lets admins through)", joinArgs?._is_admin === true);
admin = false;

for (const [reason, status, error] of [
  ["password_required", 403, "password_required"],
  ["wrong_password", 403, "wrong_password"],
  ["too_many_attempts", 429, "too_many_attempts"],
  ["room_full", 409, "room_full"],
  ["insufficient_vx", 402, "insufficient_vx"],
  ["room_not_found", 404, "room_not_found"],
  ["something_new", 403, "join_refused"],
] as [string, number, string][]) {
  joinVerdict = { allowed: false, reason };
  r = await call({ roomId: ROOM, password: "x" });
  check(`join refused as '${reason}' → ${status} ${error}, no token`, r.status === status && r.body?.error === error && !r.body?.token);
}
joinVerdict = { allowed: false, reason: "wrong_password" };
r = await call({ roomId: ROOM, password: "very-secret-guess" });
check("a refusal never echoes the password", !JSON.stringify(r.body).includes("very-secret-guess"));

joinFails = true;
r = await call({ roomId: ROOM });
check("the join call failing → 503 join_unavailable, no token (fails closed)", r.status === 503 && r.body?.error === "join_unavailable" && !r.body?.token);
joinFails = false;
joinVerdict = null;
r = await call({ roomId: ROOM });
check("an empty answer from the join → 503, no token", r.status === 503 && !r.body?.token);
joinVerdict = { allowed: "yes" };
r = await call({ roomId: ROOM });
check("a malformed answer (allowed is not a boolean) → 503, no token", r.status === 503 && !r.body?.token);
joinVerdict = { allowed: true, charged: 0 };
for (const bad of [123, ["a"], { x: 1 }, "x".repeat(129)]) {
  r = await call({ roomId: ROOM, password: bad });
  check(`a password of the wrong type or length (${JSON.stringify(bad).slice(0, 12)}…) → 400 before the join`, r.status === 400 && r.body?.error === "invalid_request" && joinArgs === null);
}
entitled = false;
r = await call({ roomId: ROOM, password: "x" });
check("an account without a plan never reaches the join (no seat, no charge)", r.status === 403 && joinArgs === null);
entitled = true;
banned = true;
r = await call({ roomId: ROOM });
check("a banned user never reaches the join", r.status === 403 && r.body?.error === "banned" && joinArgs === null);
banned = false;
room = null;
r = await call({ roomId: ROOM });
check("a room that does not exist never reaches the join", r.status === 404 && joinArgs === null);

console.log(fail ? `\n${fail} FAILURE(S)` : "\nall passed");
Deno.exit(fail ? 1 : 0);
