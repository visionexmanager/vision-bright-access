import { NotSupportedError } from "../errors.js";
import type { Customer, PaymentInfo, Providers, ServiceInfo, SessionInfo, Status } from "./types.js";

export interface MemoryCustomer extends Customer {
  service?: Omit<ServiceInfo, "username" | "status">;
  payments?: PaymentInfo[];
  online?: boolean;
  sessions?: SessionInfo[];
}

/** Test and local-development fixture provider. Holds only fictional data. */
export class MemoryProviders implements Providers {
  calls: string[] = [];
  failNext: string | null = null;
  /** When true, writes report success but change nothing (tests verification). */
  ignoreWrites = false;
  constructor(public data: Map<string, MemoryCustomer> = new Map()) {}

  static sample(): MemoryProviders {
    const m = new MemoryProviders();
    m.data.set("1001", {
      externalId: "1001", username: "user1001", fullName: "Test Customer One", phone: "96170000001",
      email: "one@example.invalid", status: "ACTIVE",
      service: { externalId: "S1", serviceType: "FTTH", package: "Fiber 100", speed: "100 Mbps", expirationDate: "2026-12-01" },
      payments: [{ externalId: "P1", amount: 25, currency: "USD", status: "PAID", paymentDate: "2026-09-01" }],
      online: true, sessions: [{ sessionId: "sess-1", startedAt: "2026-10-01T08:00:00Z" }],
    });
    m.data.set("1002", { externalId: "1002", username: "user1002", fullName: "Test Customer Two", status: "SUSPENDED", service: { externalId: "S2", package: "Fiber 50" } });
    return m;
  }

  private rec(n: string) {
    this.calls.push(n);
    if (this.failNext === n) {
      this.failNext = null;
      throw new Error("injected failure");
    }
  }
  private byUsername(u: string) {
    return [...this.data.values()].find((c) => c.username === u);
  }

  customers = {
    search: async (q: string, limit: number) => {
      this.rec("search");
      const n = q.toLowerCase();
      const all = [...this.data.values()].filter((c) => [c.externalId, c.username, c.fullName, c.phone, c.email].some((v) => v?.toLowerCase().includes(n)));
      return { items: all.slice(0, limit).map(({ service: _s, payments: _p, online: _o, sessions: _x, ...c }) => c), truncated: all.length > limit };
    },
    get: async (id: string) => {
      this.rec("get");
      const c = this.data.get(id);
      if (!c) return null;
      const { service: _s, payments: _p, online: _o, sessions: _x, ...rest } = c;
      return rest;
    },
  };
  services = {
    listForCustomer: async (id: string): Promise<ServiceInfo[]> => {
      this.rec("services");
      const c = this.data.get(id);
      return c?.service ? [{ ...c.service, username: c.username, status: c.status }] : [];
    },
  };
  payments = {
    listForCustomer: async (id: string, limit: number) => {
      this.rec("payments");
      return (this.data.get(id)?.payments ?? []).slice(0, limit);
    },
  };
  radius = {
    getUser: async (u: string) => {
      this.rec("radius.getUser");
      const c = this.byUsername(u);
      return c ? { username: u, enabled: c.status === "ACTIVE" } : null;
    },
    getUserStatus: async (u: string) => {
      this.rec("radius.status");
      const c = this.byUsername(u);
      return { username: u, enabled: c ? c.status === "ACTIVE" : null, online: c?.online ?? false };
    },
    getActiveSessions: async (u: string) => {
      this.rec("radius.sessions");
      return this.byUsername(u)?.sessions ?? [];
    },
    enableUser: async (u: string) => this.setStatus(u, "ACTIVE", "radius.enable"),
    disableUser: async (u: string) => this.setStatus(u, "SUSPENDED", "radius.disable"),
    disconnectSession: async (_u: string, _s: string) => {
      throw new NotSupportedError("disconnectSession");
    },
  };
  stats = {
    stats: async () => ({ total: this.data.size, active: [...this.data.values()].filter((c) => c.status === "ACTIVE").length }),
    expiring: async () => ({ items: [], truncated: false }),
  };
  ping = async () => true;

  private async setStatus(u: string, s: Status, call: string) {
    this.rec(call);
    const c = this.byUsername(u);
    if (c && !this.ignoreWrites) c.status = s;
  }
}
