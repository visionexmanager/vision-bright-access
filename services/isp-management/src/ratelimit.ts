import { tooMany } from "./errors.js";

export interface Rule {
  limit: number;
  windowMs: number;
}

/**
 * Sliding-window limiter, in memory. The service runs as a single instance
 * behind one gateway, so a shared store would add a dependency for no gain.
 * Documented in docs/SECURITY.md: a restart resets the windows.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private now: () => number = Date.now) {}

  /** Returns true if allowed (and records the hit). */
  take(bucket: string, key: string, rule: Rule): boolean {
    const id = `${bucket}:${key}`;
    const t = this.now();
    const fresh = (this.hits.get(id) ?? []).filter((x) => x > t - rule.windowMs);
    if (fresh.length >= rule.limit) {
      this.hits.set(id, fresh);
      return false;
    }
    fresh.push(t);
    this.hits.set(id, fresh);
    if (this.hits.size > 50_000) this.sweep(rule.windowMs);
    return true;
  }

  assert(bucket: string, key: string, rule: Rule): void {
    if (!this.take(bucket, key, rule)) throw tooMany();
  }

  private sweep(windowMs: number) {
    const t = this.now();
    for (const [k, v] of this.hits) if (!v.some((x) => x > t - windowMs)) this.hits.delete(k);
  }
}

/** Stricter for the more dangerous operation. */
export const LIMITS = {
  publicIp: { limit: 120, windowMs: 60_000 },
  loginIp: { limit: 10, windowMs: 10 * 60_000 },
  loginUser: { limit: 5, windowMs: 15 * 60_000 },
  search: { limit: 30, windowMs: 60_000 },
  customerRead: { limit: 120, windowMs: 60_000 },
  radius: { limit: 20, windowMs: 60_000 },
  stateChange: { limit: 5, windowMs: 60_000 },
  waWebhookIp: { limit: 300, windowMs: 60_000 },
  waAdmin: { limit: 30, windowMs: 60_000 },
  waUnlock: { limit: 5, windowMs: 15 * 60_000 },
  waUnknownSender: { limit: 20, windowMs: 60 * 60_000 },
} satisfies Record<string, Rule>;
