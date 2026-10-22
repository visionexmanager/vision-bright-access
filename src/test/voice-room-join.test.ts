// The voice room password, capacity and join price are decided by the server (migration 20261085).
// The behaviour is proved on a real Postgres by scripts/sql/voice-room-join-scenarios.mjs and on the
// handler by scripts/e2e/livekit-gate-harness.ts; this pins the wiring that those cannot see: what the
// migration grants, what the token function does first, and what the page no longer does itself.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const migration = read("supabase/migrations/20261085000000_voice_room_server_join.sql");
const token = read("supabase/functions/livekit-token/index.ts");
const page = read("src/pages/community/VoiceRoom.tsx");
const sqlNoComments = migration.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("voice room join: the migration", () => {
  it("keeps the password out of the room row and out of every readable table", () => {
    expect(sqlNoComments).toMatch(/NEW\.room_password := NULL/);
    expect(sqlNoComments).toMatch(/crypt\(_pw, gen_salt\('bf'/);
    for (const t of ["voice_room_secrets", "voice_room_joins", "voice_room_join_failures"]) {
      expect(sqlNoComments, t).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`));
    }
    expect(sqlNoComments).toMatch(/REVOKE ALL ON TABLE public\.voice_room_secrets, public\.voice_room_joins, public\.voice_room_join_failures FROM PUBLIC, anon, authenticated/);
    expect(sqlNoComments).not.toMatch(/CREATE POLICY/);
    expect(sqlNoComments).not.toMatch(/GRANT[^;]*TO (anon|authenticated)/);
  });

  it("hashes on insert and on any write to the column, for adult and Kids rooms", () => {
    expect(sqlNoComments).toMatch(/BEFORE INSERT OR UPDATE OF room_password ON public\.voice_rooms/);
    expect(sqlNoComments).toMatch(/BEFORE INSERT OR UPDATE OF room_password ON public\.kids_voice_rooms/);
    expect(sqlNoComments).toMatch(/UPDATE public\.voice_rooms\s+SET room_password = room_password WHERE room_password IS NOT NULL/);
  });

  it("the join is service-role only, takes the room lock, and pins its search_path", () => {
    expect(sqlNoComments).toMatch(/REVOKE ALL ON FUNCTION public\.voice_room_join\(uuid, uuid, text, text, boolean, boolean\) FROM PUBLIC, anon, authenticated/);
    expect(sqlNoComments).toMatch(/GRANT EXECUTE ON FUNCTION public\.voice_room_join\(uuid, uuid, text, text, boolean, boolean\) TO service_role/);
    expect(sqlNoComments).toMatch(/FOR UPDATE;/);
    expect(sqlNoComments).toMatch(/pg_advisory_xact_lock\(hashtextextended\('vx_spend:'/);
    const secdef = sqlNoComments.match(/SECURITY DEFINER\s+SET search_path = [^\n]+/g) ?? [];
    expect(secdef.length).toBeGreaterThanOrEqual(3);
    expect(sqlNoComments.match(/SECURITY DEFINER/g)?.length).toBe(secdef.length);
  });

  it("changes no plan, price, limit setting or existing balance", () => {
    expect(sqlNoComments).not.toMatch(/billing_plans|ops_limits|site_settings/i);
    expect(sqlNoComments).not.toMatch(/(UPDATE|DELETE FROM|INSERT INTO) public\.(user_points|vx_purchases)\b[^;]*\bWHERE true/i);
    // The only writes to the VX ledger are inside the join, and only for a price the room already carries.
    const ledgerWrites = sqlNoComments.match(/INSERT INTO public\.(user_points|vx_purchases)/g) ?? [];
    expect(ledgerWrites.length).toBe(2);
    expect(sqlNoComments.indexOf("INSERT INTO public.user_points")).toBeGreaterThan(sqlNoComments.indexOf("CREATE OR REPLACE FUNCTION public.voice_room_join"));
  });

  it("is re-runnable", () => {
    expect(sqlNoComments).toMatch(/ADD COLUMN IF NOT EXISTS has_password/);
    expect((sqlNoComments.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length).toBe(3);
    expect((sqlNoComments.match(/DROP TRIGGER IF EXISTS/g) ?? []).length).toBe(4);
  });
});

describe("voice room join: the token function", () => {
  it("asks the database before it signs anything, and fails closed", () => {
    const join = token.indexOf('rpc("voice_room_join"');
    const sign = token.indexOf("new AccessToken");
    expect(join).toBeGreaterThan(0);
    expect(sign).toBeGreaterThan(join);
    expect(token).toMatch(/join_unavailable/);
    expect(token).toMatch(/typeof verdict\.allowed !== "boolean"/);
  });

  it("checks that a token can be signed before a seat or a price is taken", () => {
    const creds = token.indexOf('!Deno.env.get("LIVEKIT_API_KEY")');
    expect(creds).toBeGreaterThan(0);
    expect(creds).toBeLessThan(token.indexOf('rpc("voice_room_join"'));
  });

  it("takes the user from the verified session, never from the request body", () => {
    expect(token).toMatch(/_user_id: user\.id/);
    expect(token).not.toMatch(/body\??\.userId/);
  });
});

describe("voice room join: the page", () => {
  it("no longer reads the password, compares it, or charges the price itself", () => {
    expect(page).not.toMatch(/room_password/);
    expect(page).not.toMatch(/password !== roomPassword/);
    expect(page).not.toMatch(/spendVX/);
    expect(page).not.toMatch(/useVXWallet/);
    expect(page).toMatch(/has_password/);
  });

  it("does not write its own membership row to join (the server does, under the lock)", () => {
    const joinFlow = page.slice(page.indexOf("const requestJoin"), page.indexOf("const handlePromoteToStage"));
    expect(joinFlow).not.toMatch(/from\("voice_room_members"\)\.upsert/);
    expect(joinFlow).toMatch(/requestVoiceToken\(/);
  });
});
