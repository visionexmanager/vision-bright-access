import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { totpAt } from "./crypto.js";
import { PiClient } from "./providers/pi/client.js";
import { PI_CONTRACT } from "./providers/pi/contract.js";
import { shapeOf } from "./providers/pi/shape.js";

/**
 * Read-only connectivity + authentication check, run ON the server by the
 * `isp-pi-check` workflow. Its output goes to a PUBLIC log, so it can only ever
 * emit lines from a closed vocabulary: a fixed label and PASS/FAIL/SKIP (and
 * an endpoint count). Nothing else can be printed because there is no other
 * output path: no response body, header, username, id, address, token, code or
 * error message is ever passed to `out`.
 */
export const LABELS = [
  "env file",
  "PI base URL",
  "PI route (DNS)",
  "PI route (TCP)",
  "token endpoint",
  "authentication",
  "read-only probe",
  "shapes file",
] as const;
export type Label = (typeof LABELS)[number];
export type Status = "PASS" | "FAIL" | "SKIP";

export const ENV_FILE = "/etc/visionex-isp/isp.env";
const SHAPES_DIRS = ["/etc/visionex-isp/", "/var/lib/visionex-isp/"];
const WANTED = ["PI_BASE_URL", "PI_USERNAME", "PI_PASSWORD", "PI_TOTP_SECRET", "PI_TEST_USERNAME", "PI_PROBE_SHAPES_FILE"] as const;
type Env = Partial<Record<(typeof WANTED)[number], string>>;

export interface FileStat {
  isFile: boolean;
  isSymlink: boolean;
  uid: number;
  mode: number;
}
export interface CheckOptions {
  envFile: string;
  probe: boolean;
  out: (line: string) => void;
  stat?: (p: string) => FileStat;
  read?: (p: string) => string;
  write?: (p: string, data: string) => void;
  fetchImpl?: typeof fetch;
  dnsLookup?: (host: string) => Promise<unknown>;
  tcpConnect?: (host: string, port: number) => Promise<boolean>;
  now?: () => number;
}

const defaultStat = (p: string): FileStat => {
  const s = lstatSync(p);
  return { isFile: s.isFile(), isSymlink: s.isSymbolicLink(), uid: s.uid, mode: s.mode & 0o777 };
};
const defaultTcp = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect({ host, port, timeout: 6000 });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("timeout", () => (s.destroy(), resolve(false)));
    s.once("error", () => resolve(false));
  });

/** KEY=VALUE lines only. The file is parsed, never executed, and only wanted keys are kept. */
export function parseEnv(text: string): Env {
  const out: Env = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim() as (typeof WANTED)[number];
    if (!WANTED.includes(key)) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    if (v) out[key] = v;
  }
  return out;
}

/** Returns the process exit code: 0 only if every requested check passed. */
export async function runPiCheck(o: CheckOptions): Promise<number> {
  let failed = false;
  const emit = (label: Label, status: Status, count?: { ok: number; total: number }) => {
    if (status === "FAIL") failed = true;
    o.out(`${label}: ${status}${count ? ` (${count.ok}/${count.total} endpoints)` : ""}`);
  };
  const stop = (label: Label) => {
    emit(label, "FAIL");
    return 1;
  };

  // 1. The secret file: a real file (not a symlink), owned by root, mode 0600 (or 0400).
  let env: Env;
  try {
    const st = (o.stat ?? defaultStat)(o.envFile);
    if (!st.isFile || st.isSymlink || st.uid !== 0 || (st.mode !== 0o600 && st.mode !== 0o400)) return stop("env file");
    env = parseEnv((o.read ?? ((p) => readFileSync(p, "utf8")))(o.envFile));
  } catch {
    return stop("env file");
  }
  if (!env.PI_BASE_URL || !env.PI_USERNAME || !env.PI_PASSWORD) return stop("env file");
  emit("env file", "PASS");

  // 2. Base URL shape. Credentials embedded in the URL would end up in places we do not control.
  let base: URL;
  try {
    base = new URL(env.PI_BASE_URL);
    if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) return stop("PI base URL");
  } catch {
    return stop("PI base URL");
  }
  emit("PI base URL", "PASS");
  const baseUrl = base.origin + base.pathname.replace(/\/$/, "");

  // 3. Routing: DNS, then a TCP connection (this is what fails when the private tunnel is down).
  try {
    await (o.dnsLookup ?? lookup)(base.hostname);
  } catch {
    return stop("PI route (DNS)");
  }
  emit("PI route (DNS)", "PASS");
  const port = Number(base.port || (base.protocol === "https:" ? 443 : 80));
  if (!(await (o.tcpConnect ?? defaultTcp)(base.hostname, port).catch(() => false))) return stop("PI route (TCP)");
  emit("PI route (TCP)", "PASS");

  // 4+5. Token endpoint reachable, then authentication. The token stays in memory.
  const f = o.fetchImpl ?? fetch;
  const login = async (otp?: string) => {
    const res = await f(`${baseUrl}/api/token/`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username: env.PI_USERNAME, password: env.PI_PASSWORD, ...(otp ? { otp_code: otp } : {}) }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body };
  };
  let r: Awaited<ReturnType<typeof login>>;
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
      r = await login(totpAt(env.PI_TOTP_SECRET, Math.floor((o.now?.() ?? Date.now()) / 30000)));
    } catch {
      return stop("authentication");
    }
  }
  const token = r.status === 200 && r.body && typeof r.body.access === "string" && r.body.access ? r.body.access : null;
  if (!token) return stop("authentication");
  emit("authentication", "PASS");

  // 6. Optional read-only probe: GET requests only, against the fixed contract paths.
  if (!o.probe) {
    emit("read-only probe", "SKIP");
    return failed ? 1 : 0;
  }
  const test = env.PI_TEST_USERNAME;
  if (!test || !/^[A-Za-z0-9._@-]{1,64}$/.test(test)) return stop("read-only probe");
  // Structural guarantee: after authentication nothing but GET can leave this process,
  // not even PiClient's automatic re-login on a 401.
  const getOnly = ((u: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if ((init?.method ?? "GET") !== "GET") throw new Error("blocked");
    return f(u, init);
  }) as typeof fetch;
  const readOnly = new PiClient({ baseUrl, username: env.PI_USERNAME, password: env.PI_PASSWORD, initialToken: token, fetchImpl: getOnly });
  const C = PI_CONTRACT;
  const probes: [string, Record<string, string>?][] = [
    [C.stats.path],
    [C.usersList.path, { [C.usersList.searchParam]: test, [C.usersList.sizeParam]: "3" }],
    [C.userGet.path, { [C.userGet.idParam]: test }],
    [C.userOverview.path, { [C.userOverview.idParam]: test }],
    [C.userInvoices.path, { [C.userInvoices.idParam]: test }],
    [C.userRefills.path, { [C.userRefills.idParam]: test }],
    [C.sessionsList.path, { [C.sessionsList.userParam]: test }],
  ];
  const shapes: Record<string, unknown> = {};
  let ok = 0;
  for (const [path, query] of probes) {
    try {
      const body = await readOnly.get(path, query); // GET only; the probe holds no other method
      if (body !== null && typeof body === "object") {
        ok++;
        shapes[path] = shapeOf(body); // key names and types only, never values
      }
    } catch {
      /* counted as a failed endpoint; the reason is deliberately not reported */
    }
  }
  emit("read-only probe", ok === probes.length ? "PASS" : "FAIL", { ok, total: probes.length });

  // Shapes go to a root-only file the owner chose, never to the log.
  const dest = env.PI_PROBE_SHAPES_FILE;
  if (dest) {
    if (!SHAPES_DIRS.some((d) => dest.startsWith(d)) || dest.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(dest)) emit("shapes file", "FAIL");
    else {
      try {
        (o.write ?? ((p, d) => writeFileSync(p, d, { mode: 0o600 })))(dest, JSON.stringify(shapes, null, 2));
        emit("shapes file", "PASS");
      } catch {
        emit("shapes file", "FAIL");
      }
    }
  }
  return failed ? 1 : 0;
}
