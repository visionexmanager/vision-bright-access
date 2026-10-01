import { totpAt } from "../../crypto.js";
import { UpstreamError } from "../../errors.js";

export interface PiClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  totpSecret?: string;
  /** A token already obtained in memory (the connectivity check logs in once, then reuses it). */
  initialToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

/**
 * Talks to the PI/Proradius backend the way its own web app does:
 * POST /api/token/ -> JWT access token, sent as `Authorization: Bearer`.
 * The token lives in memory only. Paths come from a fixed contract, never from
 * caller input, so this client cannot be steered at another endpoint.
 */
export class PiClient {
  private token: string | null = null;
  private loginInFlight: Promise<void> | null = null;
  private readonly f: typeof fetch;
  private readonly timeout: number;

  constructor(private o: PiClientOptions) {
    this.f = o.fetchImpl ?? fetch;
    this.timeout = o.timeoutMs ?? 15_000;
    this.token = o.initialToken ?? null;
  }

  private async raw(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>) {
    const u = new URL(this.o.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) u.searchParams.set(k, String(v));
    let res: Response;
    try {
      res = await this.f(u, {
        method,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
        redirect: "error",
      });
    } catch {
      throw new UpstreamError("PI unreachable", true);
    }
    return res;
  }

  private async login(): Promise<void> {
    const creds = { username: this.o.username, password: this.o.password };
    let res = await this.raw("POST", "/api/token/", creds);
    if (res.status === 202) {
      if (!this.o.totpSecret) throw new UpstreamError("PI requires 2FA and no TOTP secret is configured");
      const step = Math.floor((this.o.now?.() ?? Date.now()) / 30000);
      res = await this.raw("POST", "/api/token/", { ...creds, otp_code: totpAt(this.o.totpSecret, step) });
    }
    if (!res.ok) throw new UpstreamError(`PI login failed (${res.status})`);
    const data = (await res.json().catch(() => null)) as { access?: string } | null;
    if (!data?.access) throw new UpstreamError("PI login returned no token");
    this.token = data.access;
  }

  private ensureLogin(): Promise<void> {
    this.loginInFlight ??= this.login().finally(() => (this.loginInFlight = null));
    return this.loginInFlight;
  }

  async request(method: "GET" | "POST" | "PUT", path: string, opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {}): Promise<unknown> {
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

  get(path: string, query?: Record<string, string | number | undefined>) {
    return this.request("GET", path, { query });
  }
}
