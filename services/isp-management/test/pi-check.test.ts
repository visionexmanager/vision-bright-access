import { describe, expect, it } from "vitest";
import { base32Encode } from "../src/crypto.js";
import { LABELS, parseEnv, runPiCheck, type CheckOptions } from "../src/pi-check.js";

// Fictional values. Each one must never appear in the output.
const SECRETS = {
  user: "svc-readonly-account",
  pass: "S3cretPassw0rd-XYZ",
  totp: base32Encode(Buffer.from("totp-seed-for-tests!")),
  token: "eyJhbGciOiJIUzI1NiJ9.TOKENPAYLOAD.SIGNATURE",
  testUser: "test-customer-777",
  customerName: "Alice Customerson",
  customerPhone: "96170123456",
  customerId: "987654",
  host: "pi-portal.internal.example",
  ip: "10.9.8.7",
  setCookie: "sessionid=COOKIEVALUE123",
};
const ENV_TEXT = [
  "# comment",
  `PI_BASE_URL=https://${SECRETS.host}`,
  `PI_USERNAME=${SECRETS.user}`,
  `PI_PASSWORD="${SECRETS.pass}"`,
  `PI_TOTP_SECRET=${SECRETS.totp}`,
  `PI_TEST_USERNAME=${SECRETS.testUser}`,
  "UNRELATED_SECRET=should-be-ignored",
].join("\n");

const ALLOWED = new RegExp(`^(${LABELS.map((l) => l.replace(/[()]/g, "\\$&")).join("|")}): (PASS|FAIL|SKIP)( \\(\\d+/\\d+ endpoints\\))?$`);

interface Call { method: string; url: string; auth?: string }
function harness(over: Partial<CheckOptions> = {}, behaviour: { twoFa?: boolean; loginStatus?: number; loginBody?: unknown; throwWith?: string; leakyBodies?: boolean } = {}) {
  const lines: string[] = [];
  const calls: Call[] = [];
  const fetchImpl = (async (u: URL | string, init: RequestInit = {}) => {
    const url = new URL(String(u));
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method: String(init.method ?? "GET"), url: url.pathname + url.search, auth: headers.authorization });
    if (behaviour.throwWith) throw new Error(`boom ${behaviour.throwWith}`);
    if (url.pathname === "/api/token/") {
      const body = JSON.parse(String(init.body ?? "{}")) as { otp_code?: string };
      if (behaviour.twoFa && !body.otp_code) return new Response(JSON.stringify({ "2fa_required": true, user: SECRETS.customerName }), { status: 202 });
      return new Response(JSON.stringify(behaviour.loginBody ?? { access: SECRETS.token, user: { username: SECRETS.user, name: SECRETS.customerName } }), {
        status: behaviour.loginStatus ?? 200, headers: { "set-cookie": SECRETS.setCookie },
      });
    }
    // Every data response is stuffed with customer data and secrets on purpose.
    return new Response(JSON.stringify({ results: [{ id: SECRETS.customerId, username: SECRETS.testUser, full_name: SECRETS.customerName, phone: SECRETS.customerPhone, ip: SECRETS.ip, password: SECRETS.pass }] }), { status: 200 });
  }) as typeof fetch;
  const opts: CheckOptions = {
    envFile: "/etc/visionex-isp/isp.env", probe: false, out: (l) => lines.push(l),
    stat: () => ({ isFile: true, isSymlink: false, uid: 0, mode: 0o600 }),
    read: () => ENV_TEXT, write: () => undefined, fetchImpl,
    dnsLookup: async () => ({ address: SECRETS.ip }), tcpConnect: async () => true, now: () => 1_700_000_000_000, ...over,
  };
  return { lines, calls, run: () => runPiCheck(opts), opts };
}

function assertNoLeak(lines: string[], extra: string[] = []) {
  const all = lines.join("\n");
  for (const [k, v] of Object.entries(SECRETS)) expect(all, `leaked ${k}`).not.toContain(v);
  for (const e of extra) expect(all).not.toContain(e);
  for (const l of lines) expect(l, `unexpected line: ${l.slice(0, 40)}`).toMatch(ALLOWED);
}

describe("PI check output cannot contain secrets or customer identifiers", () => {
  it("success path: only PASS lines, nothing else, and the probe stays GET-only", async () => {
    const h = harness({ probe: true });
    expect(await h.run()).toBe(0);
    expect(h.lines).toEqual([
      "env file: PASS", "PI base URL: PASS", "PI route (DNS): PASS", "PI route (TCP): PASS", "token endpoint: PASS", "authentication: PASS", "read-only probe: PASS (7/7 endpoints)",
    ]);
    assertNoLeak(h.lines);
    // The only non-GET request is the single login; every probe call is a GET carrying the in-memory token.
    expect(h.calls.filter((c) => c.method !== "GET")).toEqual([{ method: "POST", url: "/api/token/", auth: undefined }]);
    expect(h.calls.filter((c) => c.method === "GET").every((c) => c.auth === `Bearer ${SECRETS.token}`)).toBe(true);
    expect(h.calls.filter((c) => c.method === "GET").length).toBe(7);
  });

  it("2FA: the code is generated server-side and never printed", async () => {
    const h = harness({}, { twoFa: true });
    expect(await h.run()).toBe(0);
    assertNoLeak(h.lines);
    expect(h.calls.filter((c) => c.url === "/api/token/")).toHaveLength(2);
    expect(h.lines.join("")).not.toMatch(/\b\d{6}\b/);
  });

  it("2FA required but no secret configured: fails closed", async () => {
    const h = harness({ read: () => ENV_TEXT.replace(/PI_TOTP_SECRET=.*\n/, "") }, { twoFa: true });
    expect(await h.run()).toBe(1);
    expect(h.lines.at(-1)).toBe("authentication: FAIL");
    assertNoLeak(h.lines);
  });

  it("failures with secrets inside error messages still print only the fixed vocabulary", async () => {
    for (const leak of [SECRETS.pass, SECRETS.token, SECRETS.customerName, SECRETS.host]) {
      const h = harness({}, { throwWith: leak });
      expect(await h.run()).toBe(1);
      assertNoLeak(h.lines, [leak]);
    }
    const dns = harness({ dnsLookup: async () => { throw new Error(`ENOTFOUND ${SECRETS.host} ${SECRETS.ip}`); } });
    await dns.run();
    assertNoLeak(dns.lines);
  });

  it("a rejected login, even one whose body echoes secrets, reveals nothing", async () => {
    const h = harness({}, { loginStatus: 401, loginBody: { detail: `bad password ${SECRETS.pass} for ${SECRETS.user}`, token: SECRETS.token } });
    expect(await h.run()).toBe(1);
    expect(h.lines.at(-1)).toBe("authentication: FAIL");
    assertNoLeak(h.lines);
  });

  it("probe failures report counts only", async () => {
    const h = harness({ probe: true });
    const real = h.opts.fetchImpl!;
    h.opts.fetchImpl = (async (u: URL | string, i?: RequestInit) => (String(u).includes("sessions") ? new Response(`oops ${SECRETS.customerName}`, { status: 500 }) : real(u, i))) as typeof fetch;
    expect(await h.run()).toBe(1);
    expect(h.lines.at(-1)).toBe("read-only probe: FAIL (6/7 endpoints)");
    assertNoLeak(h.lines);
  });

  it("the probe cannot issue anything but GET, not even a re-login after a 401", async () => {
    const h = harness({ probe: true });
    const real = h.opts.fetchImpl!;
    h.opts.fetchImpl = (async (u: URL | string, i?: RequestInit) => (String(u).includes("/api/user/overview/") ? new Response("{}", { status: 401 }) : real(u, i))) as typeof fetch;
    await h.run();
    expect(h.calls.filter((c) => c.method !== "GET")).toHaveLength(1); // only the one authentication POST
    expect(h.lines.at(-1)).toMatch(/read-only probe: FAIL/);
  });

  it("the test username comes from the protected file only; without it the requested probe fails closed", async () => {
    const h = harness({ probe: true, read: () => ENV_TEXT.replace(/PI_TEST_USERNAME=.*\n/, "") });
    expect(await h.run()).toBe(1);
    expect(h.lines.at(-1)).toBe("read-only probe: FAIL");
    expect(h.calls.filter((c) => c.method === "GET")).toHaveLength(0);
    assertNoLeak(h.lines);
  });

  it("probe not requested: skipped, no customer endpoint is touched", async () => {
    const h = harness();
    expect(await h.run()).toBe(0);
    expect(h.lines.at(-1)).toBe("read-only probe: SKIP");
    expect(h.calls.filter((c) => c.method === "GET")).toHaveLength(0);
  });

  it("response shapes go to the chosen root-only file, never the log, and only under approved directories", async () => {
    let written: { p: string; d: string } | null = null;
    const ok = harness({ probe: true, read: () => ENV_TEXT + "\nPI_PROBE_SHAPES_FILE=/etc/visionex-isp/pi-shapes.json", write: (p, d) => { written = { p, d }; } });
    await ok.run();
    expect(ok.lines.at(-1)).toBe("shapes file: PASS");
    assertNoLeak(ok.lines);
    expect(written!.d).not.toContain(SECRETS.customerName); // key names and types only
    expect(written!.d).toContain("full_name");
    for (const bad of ["/tmp/x.json", "/etc/visionex-isp/../shadow", "/etc/visionex-isp/a b"]) {
      const h = harness({ probe: true, read: () => ENV_TEXT + `\nPI_PROBE_SHAPES_FILE=${bad}`, write: () => { throw new Error("must not write"); } });
      await h.run();
      expect(h.lines.at(-1)).toBe("shapes file: FAIL");
    }
  });
});

describe("fails closed", () => {
  const cases: [string, Partial<CheckOptions>, string][] = [
    ["env file missing", { stat: () => { throw new Error("ENOENT"); } }, "env file: FAIL"],
    ["wrong owner", { stat: () => ({ isFile: true, isSymlink: false, uid: 1000, mode: 0o600 }) }, "env file: FAIL"],
    ["group/world readable", { stat: () => ({ isFile: true, isSymlink: false, uid: 0, mode: 0o640 }) }, "env file: FAIL"],
    ["a symlink", { stat: () => ({ isFile: true, isSymlink: true, uid: 0, mode: 0o600 }) }, "env file: FAIL"],
    ["not a regular file", { stat: () => ({ isFile: false, isSymlink: false, uid: 0, mode: 0o600 }) }, "env file: FAIL"],
    ["credentials missing", { read: () => "PI_BASE_URL=https://x.example" }, "env file: FAIL"],
    ["base URL with embedded credentials", { read: () => ENV_TEXT.replace(/PI_BASE_URL=.*/, "PI_BASE_URL=https://u:p@x.example") }, "PI base URL: FAIL"],
    ["non-http base URL", { read: () => ENV_TEXT.replace(/PI_BASE_URL=.*/, "PI_BASE_URL=ftp://x.example") }, "PI base URL: FAIL"],
    ["DNS failure", { dnsLookup: async () => { throw new Error("x"); } }, "PI route (DNS): FAIL"],
    ["tunnel down (TCP refused)", { tcpConnect: async () => false }, "PI route (TCP): FAIL"],
  ];
  for (const [name, over, last] of cases)
    it(name, async () => {
      const h = harness(over);
      expect(await h.run()).toBe(1);
      expect(h.lines.at(-1)).toBe(last);
      assertNoLeak(h.lines);
      expect(h.calls).toHaveLength(0); // nothing was sent anywhere
    });

  it("token endpoint unavailable (404 / 500 / network error)", async () => {
    for (const status of [404, 500, 503]) {
      const h = harness({}, { loginStatus: status, loginBody: {} });
      expect(await h.run()).toBe(1);
      expect(h.lines.at(-1)).toBe("token endpoint: FAIL");
    }
    const h = harness({}, { throwWith: "x" });
    await h.run();
    expect(h.lines.at(-1)).toBe("token endpoint: FAIL");
  });

  it("unexpected authentication response (200 without a token, or a non-string token)", async () => {
    for (const loginBody of [{}, { access: 123 }, { access: "" }, "nope", []]) {
      const h = harness({}, { loginBody });
      expect(await h.run()).toBe(1);
      expect(h.lines.at(-1)).toBe("authentication: FAIL");
      assertNoLeak(h.lines);
    }
  });
});

describe("env file parsing", () => {
  it("parses, never executes, and keeps only the wanted keys", () => {
    const e = parseEnv(`PI_USERNAME=a\nPI_PASSWORD='b c'\nPI_BASE_URL=https://x # note\nOTHER=1\nPI_TEST_USERNAME=$(touch /tmp/pwned)\n`);
    expect(e).toEqual({ PI_USERNAME: "a", PI_PASSWORD: "b c", PI_BASE_URL: "https://x", PI_TEST_USERNAME: "$(touch /tmp/pwned)" });
    expect(Object.keys(e)).not.toContain("OTHER");
  });
});
