import { readFileSync } from "node:fs";
import { z } from "zod";
import { NotSupportedError } from "../../errors.js";
import type { Customer, Page, PaymentInfo, Providers, RadiusStatus, ServiceInfo } from "../types.js";
import type { PiClient } from "./client.js";
import { mapCustomer, mapPayment, mapService, mapSession, unwrapList, unwrapObject } from "./mapper.js";

export { PI_CONTRACT } from "./contract.js";
import { PI_CONTRACT } from "./contract.js";

const actionTemplate = z
  .object({
    method: z.enum(["POST", "PUT"]),
    path: z.string().regex(/^\/api\/[A-Za-z0-9_\-/]+$/),
    /** "$username" and "$customerId" are substituted; nothing else is. */
    body: z.record(z.string(), z.unknown()),
  })
  .strict();
export type ActionTemplate = z.infer<typeof actionTemplate>;
const actionsFile = z
  .object({ ENABLE: actionTemplate.optional(), DISABLE: actionTemplate.optional(), DISCONNECT: actionTemplate.optional() })
  .strict();
export type PiActions = z.infer<typeof actionsFile>;

/**
 * Write operations are NOT hard-coded. PI's bulk-action payloads were never
 * observed, so they come from a file written after capturing a real request
 * from the PI UI on a test account. With no file, every write is
 * NotSupported, which the action engine reports honestly.
 */
export function loadPiActions(path?: string): PiActions {
  if (!path) return {};
  return actionsFile.parse(JSON.parse(readFileSync(path, "utf8")));
}

const subst = (v: unknown, vars: Record<string, string>): unknown => {
  if (typeof v === "string") return v.startsWith("$") && v.slice(1) in vars ? vars[v.slice(1)] : v;
  if (Array.isArray(v)) return v.map((x) => subst(x, vars));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, subst(x, vars)]));
  return v;
};

export function createPiProviders(client: PiClient, actions: PiActions = {}): Providers {
  const C = PI_CONTRACT;

  const getCustomer = async (id: string): Promise<Customer | null> => {
    const body = await client.get(C.userGet.path, { [C.userGet.idParam]: id });
    const o = unwrapObject(body);
    if (!o) return null;
    const c = mapCustomer(o);
    // Never trust a record that is not the one asked for.
    return c && (c.externalId === id || c.username === id) ? c : null;
  };

  const run = async (kind: keyof PiActions, username: string, customerId = username) => {
    const t = actions[kind];
    if (!t) throw new NotSupportedError(kind);
    await client.request(t.method, t.path, { body: subst(t.body, { username, customerId }) });
  };

  return {
    customers: {
      async search(query, limit): Promise<Page<Customer>> {
        const body = await client.get(C.usersList.path, { [C.usersList.searchParam]: query, [C.usersList.sizeParam]: limit + 1 });
        const all = unwrapList(body).map(mapCustomer).filter((c): c is Customer => c !== null);
        return { items: all.slice(0, limit), truncated: all.length > limit };
      },
      get: getCustomer,
    },
    services: {
      async listForCustomer(id): Promise<ServiceInfo[]> {
        const c = await getCustomer(id);
        if (!c) return [];
        const o = unwrapObject(await client.get(C.userOverview.path, { [C.userOverview.idParam]: id }));
        return o ? [{ ...mapService(o, c.username), status: c.status }] : [];
      },
    },
    payments: {
      async listForCustomer(id, limit): Promise<PaymentInfo[]> {
        const rows = [
          ...unwrapList(await client.get(C.userInvoices.path, { [C.userInvoices.idParam]: id })),
          ...unwrapList(await client.get(C.userRefills.path, { [C.userRefills.idParam]: id })),
        ];
        return rows.map(mapPayment).filter((p): p is PaymentInfo => p !== null).slice(0, limit);
      },
    },
    radius: {
      async getUser(username) {
        const c = await getCustomer(username);
        return c ? { username: c.username, enabled: c.status === "UNKNOWN" ? null : c.status === "ACTIVE" } : null;
      },
      async getUserStatus(username): Promise<RadiusStatus> {
        const [c, sessions] = await Promise.all([getCustomer(username), this.getActiveSessions(username)]);
        return { username, enabled: !c || c.status === "UNKNOWN" ? null : c.status === "ACTIVE", online: sessions.length > 0 };
      },
      async getActiveSessions(username) {
        const rows = unwrapList(await client.get(C.sessionsList.path, { [C.sessionsList.userParam]: username }));
        return rows.map(mapSession);
      },
      enableUser: (u) => run("ENABLE", u),
      disableUser: (u) => run("DISABLE", u),
      disconnectSession: (u) => run("DISCONNECT", u),
    },
    stats: {
      async stats() {
        const o = unwrapObject(await client.get(C.stats.path));
        if (!o) return null;
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(o)) if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
        return Object.keys(out).length ? out : null;
      },
      async expiring() {
        // No verified PI endpoint filters by expiry; reported as empty, not guessed.
        return { items: [], truncated: false };
      },
    },
    async ping() {
      try {
        await client.get(C.stats.path);
        return true;
      } catch {
        return false;
      }
    },
  };
}
