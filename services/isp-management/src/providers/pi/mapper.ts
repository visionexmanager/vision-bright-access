import type { Customer, PaymentInfo, ServiceInfo, SessionInfo, Status } from "../types.js";

/**
 * Field-name tolerance. The PI response shapes have NOT been observed (no
 * credentials were available during discovery), so each normalised field
 * accepts the usual aliases. Anything that cannot be mapped becomes UNKNOWN,
 * and the action engine refuses to act on UNKNOWN, so a wrong guess fails
 * safe instead of changing the wrong state. scripts/pi-contract-probe.mjs
 * prints the real shapes (keys and types, never values) to replace guesses.
 */
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function unwrapList(body: unknown): Obj[] {
  if (Array.isArray(body)) return body.filter(isObj);
  if (!isObj(body)) return [];
  for (const k of ["results", "data", "body", "items", "users", "rows"]) {
    const v = body[k];
    if (Array.isArray(v)) return v.filter(isObj);
    if (isObj(v)) {
      const inner = unwrapList(v);
      if (inner.length) return inner;
    }
  }
  return [];
}

export function unwrapObject(body: unknown): Obj | null {
  if (!isObj(body)) return null;
  for (const k of ["body", "data", "info", "result"]) if (isObj(body[k])) return body[k] as Obj;
  return body;
}

const pick = (o: Obj, keys: string[]): unknown => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  return undefined;
};
const str = (v: unknown): string | undefined => (typeof v === "string" ? v.trim() || undefined : typeof v === "number" ? String(v) : undefined);
const iso = (v: unknown): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export function normalizeStatus(o: Obj): Status {
  const raw = pick(o, ["status", "state", "account_status", "user_status"]);
  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    if (/^(active|enabled|online|ok)$/.test(s)) return "ACTIVE";
    if (/(suspend|inactive|disabled|blocked|punish)/.test(s)) return "SUSPENDED";
    if (/expire/.test(s)) return "EXPIRED";
    if (/(terminat|deleted|archiv)/.test(s)) return "TERMINATED";
  }
  const en = pick(o, ["enabled", "is_active", "active"]);
  if (typeof en === "boolean") return en ? "ACTIVE" : "SUSPENDED";
  if (pick(o, ["expired", "is_expired"]) === true) return "EXPIRED";
  return "UNKNOWN";
}

export function mapCustomer(o: Obj): Customer | null {
  const username = str(pick(o, ["username", "user", "login", "name_login"]));
  const externalId = str(pick(o, ["id", "pk", "user_id", "userid", "uid", "rowid"])) ?? username;
  if (!externalId || !username) return null;
  const first = str(pick(o, ["first_name", "firstname"]));
  const last = str(pick(o, ["last_name", "lastname"]));
  return {
    externalId,
    username,
    fullName: str(pick(o, ["full_name", "fullname", "name"])) ?? ([first, last].filter(Boolean).join(" ") || undefined),
    phone: str(pick(o, ["phone", "mobile", "phone_number", "mobilenumber"])),
    email: str(pick(o, ["email", "mail"])),
    address: str(pick(o, ["address", "location"])),
    status: normalizeStatus(o),
  };
}

export function mapService(o: Obj, username: string): ServiceInfo {
  return {
    externalId: str(pick(o, ["service_id", "serviceid", "srvid", "id"])) ?? username,
    username,
    serviceType: str(pick(o, ["service_type", "type"])),
    package: str(pick(o, ["service_name", "service", "package", "plan", "srvname"])),
    speed: str(pick(o, ["speed", "bandwidth", "rate_limit", "download_speed"])),
    status: normalizeStatus(o),
    activationDate: iso(pick(o, ["activation_date", "created_at", "start_date", "registered"])),
    expirationDate: iso(pick(o, ["expiration", "expiration_date", "expiry", "expire_date", "expires_at"])),
    suspensionDate: iso(pick(o, ["suspension_date", "suspended_at"])),
  };
}

export function mapPayment(o: Obj): PaymentInfo | null {
  const amount = Number(pick(o, ["amount", "price", "total", "value"]));
  if (!Number.isFinite(amount)) return null;
  return {
    externalId: str(pick(o, ["id", "invoice_id", "transaction_id", "rowid"])) ?? `${amount}-${str(pick(o, ["date", "created_at"])) ?? "?"}`,
    amount,
    currency: str(pick(o, ["currency"])) ?? "USD",
    paymentDate: iso(pick(o, ["payment_date", "date", "created_at", "paid_at"])),
    dueDate: iso(pick(o, ["due_date"])),
    status: str(pick(o, ["status", "state"])) ?? "UNKNOWN",
    method: str(pick(o, ["method", "payment_method", "type"])),
  };
}

export function mapSession(o: Obj): SessionInfo {
  const num = (v: unknown) => (Number.isFinite(Number(v)) && v !== undefined && v !== null ? Number(v) : undefined);
  return {
    sessionId: str(pick(o, ["acctsessionid", "session_id", "id", "rowid"])) ?? "unknown",
    startedAt: iso(pick(o, ["acctstarttime", "start_time", "started_at"])),
    durationSeconds: num(pick(o, ["acctsessiontime", "duration"])),
    bytesIn: num(pick(o, ["acctinputoctets", "bytes_in", "upload"])),
    bytesOut: num(pick(o, ["acctoutputoctets", "bytes_out", "download"])),
    // NAS address / calling station are intentionally dropped here.
  };
}
