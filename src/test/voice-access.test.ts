// The gate in front of the money.
//
// Before this existed, `text-to-speech` and `ai-voice-chat` checked nothing: the
// gateway's `verify_jwt` accepted the publishable key that ships in the public
// bundle, and both functions call a paid provider on every request. So the two
// tests that matter most here are the two that used to pass by doing nothing —
// an anonymous caller is refused, and every allowed caller is charged.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decideVoiceAccess,
  refusalResponse,
  type VoiceAccessPorts,
} from "../../supabase/functions/_shared/voice/access.ts";

/** A recording stand-in for the two things the live guard talks to. */
function ports(overrides: Partial<VoiceAccessPorts> = {}) {
  const charged: Array<{ userId: string; functionName: string }> = [];
  const identified: string[] = [];
  const port: VoiceAccessPorts = {
    async identify(authHeader) {
      identified.push(authHeader);
      // The publishable key is a valid JWT that belongs to nobody. That is the
      // entire shape of the hole, so it is the default here.
      return authHeader === "Bearer user-token" ? { id: "user-1" } : null;
    },
    async checkLimit(userId, functionName) {
      charged.push({ userId, functionName });
      return true;
    },
    ...overrides,
  };
  return { port, charged, identified };
}

const decide = (authHeader: string | null, port: VoiceAccessPorts, functionName = "text-to-speech") =>
  decideVoiceAccess({ authHeader, configured: true, functionName, ports: port });

describe("who gets through", () => {
  it("lets a signed-in caller through and tells the caller who they are", async () => {
    const { port } = ports();
    const result = await decide("Bearer user-token", port);
    expect(result).toEqual({ outcome: "allowed", userId: "user-1" });
  });

  it("refuses a request with no Authorization header at all", async () => {
    const { port, identified } = ports();
    const result = await decide(null, port);
    expect(result).toMatchObject({ outcome: "refused", refusal: { status: 401 } });
    // And does not spend a round trip finding that out.
    expect(identified).toEqual([]);
  });

  it("refuses the publishable key, which is a valid JWT belonging to nobody", async () => {
    // This is the case the old code allowed: anybody who read the page source
    // could call a paid provider, attributable to no one.
    const { port, charged } = ports();
    const result = await decide("Bearer anon-publishable-key", port);
    expect(result).toMatchObject({ outcome: "refused", refusal: { status: 401 } });
    expect(charged).toEqual([]);
  });

  it("refuses a token the auth service rejects", async () => {
    const { port } = ports({ async identify() { return null; } });
    expect(await decide("Bearer expired", port)).toMatchObject({ outcome: "refused", refusal: { status: 401 } });
  });

  it("refuses rather than guesses when the server is not configured", async () => {
    const { port, identified } = ports();
    const result = await decideVoiceAccess({
      authHeader: "Bearer user-token",
      configured: false,
      functionName: "text-to-speech",
      ports: port,
    });
    expect(result).toMatchObject({ outcome: "refused", refusal: { status: 500 } });
    expect(identified).toEqual([]);
  });
});

describe("what a caller costs", () => {
  it("charges the quota before the provider is ever reached", async () => {
    const { port, charged } = ports();
    await decide("Bearer user-token", port, "ai-voice-chat");
    expect(charged).toEqual([{ userId: "user-1", functionName: "ai-voice-chat" }]);
  });

  it("attributes the spend to the endpoint that made it", async () => {
    // The name lands in `ai_usage_log`. Two endpoints sharing one name would
    // make the log unreadable and the two daily limits into one.
    const { port, charged } = ports();
    await decide("Bearer user-token", port, "text-to-speech");
    await decide("Bearer user-token", port, "ai-voice-chat");
    expect(charged.map((entry) => entry.functionName))
      .toEqual(["text-to-speech", "ai-voice-chat"]);
  });

  it("refuses a caller who has spent their day's allowance", async () => {
    const { port } = ports({ async checkLimit() { return false; } });
    expect(await decide("Bearer user-token", port))
      .toMatchObject({ outcome: "refused", refusal: { status: 429 } });
  });

  it("fails closed when the quota system itself cannot answer", async () => {
    // An accounting system that is down is not a reason to hand out free
    // provider calls. This line is only reached by a request about to spend.
    const { port } = ports({ async checkLimit() { return "error"; } });
    expect(await decide("Bearer user-token", port))
      .toMatchObject({ outcome: "refused", refusal: { status: 429 } });
  });

  it("charges each attempt, so a failing provider cannot be retried for free", async () => {
    // The RPC writes its row when it allows a request, not when the request
    // succeeds. If failures were free, forcing them would be an unlimited path.
    const { port, charged } = ports();
    await decide("Bearer user-token", port);
    await decide("Bearer user-token", port);
    await decide("Bearer user-token", port);
    expect(charged).toHaveLength(3);
  });

  it("does not charge anybody it refused", async () => {
    const { port, charged } = ports();
    await decide(null, port);
    await decide("Bearer anon-publishable-key", port);
    expect(charged).toEqual([]);
  });
});

describe("what the caller is told", () => {
  it("answers with the JSON shape these endpoints already return", async () => {
    const response = refusalResponse(
      { status: 401, error: "Unauthorized" },
      { "Access-Control-Allow-Origin": "https://visionex.app" },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://visionex.app");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("says nothing about who the user is or what their limit was", async () => {
    // A refusal is not the place to leak an account's existence or its usage.
    const { port } = ports({ async checkLimit() { return false; } });
    const result = await decide("Bearer user-token", port);
    expect(result.outcome).toBe("refused");
    if (result.outcome !== "refused") return;
    const body = await refusalResponse(result.refusal, {}).text();
    expect(body).not.toContain("user-1");
    expect(body).toBe(JSON.stringify({ error: "Rate limit reached. Please try again later." }));
  });
});

describe("the endpoints that spend the money", () => {
  const endpoints = [
    ["text-to-speech", "supabase/functions/text-to-speech/index.ts"],
    ["ai-voice-chat", "supabase/functions/ai-voice-chat/index.ts"],
  ] as const;

  for (const [name, path] of endpoints) {
    // A decision nothing calls is not a gate. These two assertions are the
    // difference between the policy above being enforced and being decorative.
    it(`${name} guards, under its own name`, () => {
      const source = readFileSync(path, "utf8");
      expect(source).toContain(`guardVoiceRequest(req, "${name}")`);
      expect(source).toMatch(/if \(guard\.outcome === "refused"\) return refusalResponse\(/);
    });

    it(`${name} guards before it reads the body or reaches for a provider key`, () => {
      // Order matters: a caller that fails the check must never have reached a
      // provider, and must not be able to make the server do work first.
      // Measured from inside the handler, not from the top of the file: the
      // import line also contains the word, and searching the whole source
      // made this assertion pass with the call itself deleted.
      const source = readFileSync(path, "utf8");
      const handler = source.slice(source.indexOf("Deno.serve("));
      const guard = handler.indexOf("await guardVoiceRequest(req,");
      const body = handler.indexOf("await req.json()");
      const key = handler.indexOf("OPENAI_API_KEY");
      expect(guard).toBeGreaterThan(-1);
      expect(body).toBeGreaterThan(-1);
      expect(key).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(body);
      expect(guard).toBeLessThan(key);
    });
  }

  it("leaves the WhatsApp sender limits alone", () => {
    // The voice quota is per signed-in website user. WhatsApp senders are rate
    // limited by their own, older mechanism, and this work does not touch it.
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).not.toContain("guardVoiceRequest");
    expect(webhook).not.toContain("check_ai_rate_limit");
  });

  it("stops the website caller from sending the public key as its bearer", () => {
    // The library reader used to authenticate itself with the publishable key,
    // which is exactly what the guard now refuses — the client had to change
    // with it or read-aloud would simply have stopped working for everyone.
    const client = readFileSync("src/lib/library/textToSpeech.ts", "utf8");
    expect(client).toContain("supabase.auth.getSession()");
    expect(client).toContain("Bearer ${token}");
    expect(client).not.toContain("Bearer ${key}");
  });
});
