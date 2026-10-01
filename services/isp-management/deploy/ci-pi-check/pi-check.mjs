// src/pi-check.ts
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import net from "node:net";

// src/crypto.ts
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual
} from "node:crypto";
var SCRYPT = { N: 32768, r: 8, p: 1, keylen: 32, maxmem: 128 * 1024 * 1024 };
var B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s) {
  const clean = s.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("bad base32");
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totpAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const off = (h[h.length - 1] ?? 0) & 15;
  const code2 = ((h[off] ?? 0) & 127) << 24 | ((h[off + 1] ?? 0) & 255) << 16 | ((h[off + 2] ?? 0) & 255) << 8 | (h[off + 3] ?? 0) & 255;
  return String(code2 % 1e6).padStart(6, "0");
}

// src/errors.ts
var UpstreamError = class extends Error {
  constructor(message, retriable = false) {
    super(message);
    this.retriable = retriable;
    this.name = "UpstreamError";
  }
  retriable;
};

// src/providers/pi/client.ts
var PiClient = class {
  constructor(o) {
    this.o = o;
    this.f = o.fetchImpl ?? fetch;
    this.timeout = o.timeoutMs ?? 15e3;
    this.token = o.initialToken ?? null;
  }
  o;
  token = null;
  loginInFlight = null;
  f;
  timeout;
  async raw(method, path, body, query) {
    const u = new URL(this.o.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== void 0) u.searchParams.set(k, String(v));
    let res;
    try {
      res = await this.f(u, {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...this.token ? { authorization: `Bearer ${this.token}` } : {}
        },
        body: body === void 0 ? void 0 : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
        redirect: "error"
      });
    } catch {
      throw new UpstreamError("PI unreachable", true);
    }
    return res;
  }
  async login() {
    const creds = { username: this.o.username, password: this.o.password };
    let res = await this.raw("POST", "/api/token/", creds);
    if (res.status === 202) {
      if (!this.o.totpSecret) throw new UpstreamError("PI requires 2FA and no TOTP secret is configured");
      const step = Math.floor((this.o.now?.() ?? Date.now()) / 3e4);
      res = await this.raw("POST", "/api/token/", { ...creds, otp_code: totpAt(this.o.totpSecret, step) });
    }
    if (!res.ok) throw new UpstreamError(`PI login failed (${res.status})`);
    const data = await res.json().catch(() => null);
    if (!data?.access) throw new UpstreamError("PI login returned no token");
    this.token = data.access;
  }
  ensureLogin() {
    this.loginInFlight ??= this.login().finally(() => this.loginInFlight = null);
    return this.loginInFlight;
  }
  async request(method, path, opts = {}) {
    if (!this.token) await this.ensureLogin();
    let res = await this.raw(method, path, opts.body, opts.query);
    if (res.status === 401) {
      this.token = null;
      await this.ensureLogin();
      res = await this.raw(method, path, opts.body, opts.query);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new UpstreamError(`PI ${method} ${path} -> ${res.status}`, res.status >= 500);
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }
  get(path, query) {
    return this.request("GET", path, { query });
  }
};

// src/providers/pi/contract.ts
var PI_CONTRACT = {
  usersList: { path: "/api/users", searchParam: "search", sizeParam: "page_size", verified: false },
  userGet: { path: "/api/user/", idParam: "id", verified: false },
  userOverview: { path: "/api/user/overview/", idParam: "id", verified: false },
  userInvoices: { path: "/api/user/invoices/", idParam: "id", verified: false },
  userRefills: { path: "/api/user/refills", idParam: "id", verified: false },
  sessionsList: { path: "/api/sessions/list", userParam: "username", verified: false },
  stats: { path: "/api/getstats", verified: false }
};

// src/providers/pi/shape.ts
function shapeOf(v, depth = 0) {
  if (v === null) return "null";
  if (Array.isArray(v)) return depth > 4 ? "array" : { array: v.length === 0 ? "empty" : shapeOf(v[0], depth + 1), length: v.length };
  if (typeof v === "object") {
    if (depth > 4) return "object";
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shapeOf(x, depth + 1)]));
  }
  return typeof v;
}

// src/pi-check.ts
var ENV_FILE = "/etc/visionex-isp/isp.env";
var SHAPES_DIRS = ["/etc/visionex-isp/", "/var/lib/visionex-isp/"];
var WANTED = ["PI_BASE_URL", "PI_USERNAME", "PI_PASSWORD", "PI_TOTP_SECRET", "PI_TEST_USERNAME", "PI_PROBE_SHAPES_FILE"];
var defaultStat = (p) => {
  const s = lstatSync(p);
  return { isFile: s.isFile(), isSymlink: s.isSymbolicLink(), uid: s.uid, mode: s.mode & 511 };
};
var defaultTcp = (host, port) => new Promise((resolve) => {
  const s = net.connect({ host, port, timeout: 6e3 });
  s.once("connect", () => (s.destroy(), resolve(true)));
  s.once("timeout", () => (s.destroy(), resolve(false)));
  s.once("error", () => resolve(false));
});
function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!WANTED.includes(key)) continue;
    let v = line.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"') && v.length >= 2 || v.startsWith("'") && v.endsWith("'") && v.length >= 2) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (v) out[key] = v;
  }
  return out;
}
async function runPiCheck(o) {
  let failed = false;
  const emit = (label, status, count) => {
    if (status === "FAIL") failed = true;
    o.out(`${label}: ${status}${count ? ` (${count.ok}/${count.total} endpoints)` : ""}`);
  };
  const stop = (label) => {
    emit(label, "FAIL");
    return 1;
  };
  let env;
  try {
    const st = (o.stat ?? defaultStat)(o.envFile);
    if (!st.isFile || st.isSymlink || st.uid !== 0 || st.mode !== 384 && st.mode !== 256) return stop("env file");
    env = parseEnv((o.read ?? ((p) => readFileSync(p, "utf8")))(o.envFile));
  } catch {
    return stop("env file");
  }
  if (!env.PI_BASE_URL || !env.PI_USERNAME || !env.PI_PASSWORD) return stop("env file");
  emit("env file", "PASS");
  let base;
  try {
    base = new URL(env.PI_BASE_URL);
    if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) return stop("PI base URL");
  } catch {
    return stop("PI base URL");
  }
  emit("PI base URL", "PASS");
  const baseUrl = base.origin + base.pathname.replace(/\/$/, "");
  try {
    await (o.dnsLookup ?? lookup)(base.hostname);
  } catch {
    return stop("PI route (DNS)");
  }
  emit("PI route (DNS)", "PASS");
  const port = Number(base.port || (base.protocol === "https:" ? 443 : 80));
  if (!await (o.tcpConnect ?? defaultTcp)(base.hostname, port).catch(() => false)) return stop("PI route (TCP)");
  emit("PI route (TCP)", "PASS");
  const f = o.fetchImpl ?? fetch;
  const login = async (otp) => {
    const res = await f(`${baseUrl}/api/token/`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username: env.PI_USERNAME, password: env.PI_PASSWORD, ...otp ? { otp_code: otp } : {} }),
      signal: AbortSignal.timeout(15e3),
      redirect: "error"
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  };
  let r;
  try {
    r = await login();
  } catch {
    return stop("token endpoint");
  }
  if (r.status === 404 || r.status >= 500) return stop("token endpoint");
  emit("token endpoint", "PASS");
  if (r.status === 202 && r.body && "2fa_required" in r.body) {
    if (!env.PI_TOTP_SECRET) return stop("authentication");
    try {
      r = await login(totpAt(env.PI_TOTP_SECRET, Math.floor((o.now?.() ?? Date.now()) / 3e4)));
    } catch {
      return stop("authentication");
    }
  }
  const token = r.status === 200 && r.body && typeof r.body.access === "string" && r.body.access ? r.body.access : null;
  if (!token) return stop("authentication");
  emit("authentication", "PASS");
  if (!o.probe) {
    emit("read-only probe", "SKIP");
    return failed ? 1 : 0;
  }
  const test = env.PI_TEST_USERNAME;
  if (!test || !/^[A-Za-z0-9._@-]{1,64}$/.test(test)) return stop("read-only probe");
  const getOnly = ((u, init) => {
    if ((init?.method ?? "GET") !== "GET") throw new Error("blocked");
    return f(u, init);
  });
  const readOnly = new PiClient({ baseUrl, username: env.PI_USERNAME, password: env.PI_PASSWORD, initialToken: token, fetchImpl: getOnly });
  const C = PI_CONTRACT;
  const probes = [
    [C.stats.path],
    [C.usersList.path, { [C.usersList.searchParam]: test, [C.usersList.sizeParam]: "3" }],
    [C.userGet.path, { [C.userGet.idParam]: test }],
    [C.userOverview.path, { [C.userOverview.idParam]: test }],
    [C.userInvoices.path, { [C.userInvoices.idParam]: test }],
    [C.userRefills.path, { [C.userRefills.idParam]: test }],
    [C.sessionsList.path, { [C.sessionsList.userParam]: test }]
  ];
  const shapes = {};
  let ok = 0;
  for (const [path, query] of probes) {
    try {
      const body = await readOnly.get(path, query);
      if (body !== null && typeof body === "object") {
        ok++;
        shapes[path] = shapeOf(body);
      }
    } catch {
    }
  }
  emit("read-only probe", ok === probes.length ? "PASS" : "FAIL", { ok, total: probes.length });
  const dest = env.PI_PROBE_SHAPES_FILE;
  if (dest) {
    if (!SHAPES_DIRS.some((d) => dest.startsWith(d)) || dest.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(dest)) emit("shapes file", "FAIL");
    else {
      try {
        (o.write ?? ((p, d) => writeFileSync(p, d, { mode: 384 })))(dest, JSON.stringify(shapes, null, 2));
        emit("shapes file", "PASS");
      } catch {
        emit("shapes file", "FAIL");
      }
    }
  }
  return failed ? 1 : 0;
}

// scripts/pi-check-main.ts
var bail = () => {
  process.stdout.write("authentication: FAIL\n");
  process.exit(1);
};
process.on("uncaughtException", bail);
process.on("unhandledRejection", bail);
var code = await runPiCheck({ envFile: ENV_FILE, probe: process.argv.includes("--probe"), out: (l) => process.stdout.write(l + "\n") });
process.exit(code);
