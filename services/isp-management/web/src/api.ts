export type Role = "SUPER_ADMIN" | "ADMIN" | "WHATSAPP_ADMIN" | "READ_ONLY_ADMIN";
export interface Me {
  user: { username: string; displayName: string; role: Role };
  csrf: string;
  mfaSetupRequired: boolean;
}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// The CSRF token lives in memory only (never localStorage); the session itself is an HttpOnly cookie.
let csrf = "";
export const setCsrf = (t: string) => (csrf = t);
let onUnauthorized: () => void = () => undefined;
export const setUnauthorizedHandler = (f: () => void) => (onUnauthorized = f);

export async function api<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { "x-csrf-token": csrf } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  if (!res.ok) {
    if (res.status === 401 && path !== "/api/auth/login") onUnauthorized();
    throw new ApiError(res.status, data?.error?.code ?? "ERROR", data?.error?.message ?? "Something went wrong.");
  }
  return data as T;
}

export const can = {
  manageAdmins: (r: Role) => r === "SUPER_ADMIN",
  audit: (r: Role) => r === "SUPER_ADMIN" || r === "ADMIN",
  act: (r: Role) => r !== "READ_ONLY_ADMIN",
};

export type Status = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TERMINATED" | "UNKNOWN";
export interface Customer { externalId: string; username: string; fullName?: string; phone?: string; email?: string; address?: string; status: Status }
export interface ServiceInfo { externalId: string; package?: string; speed?: string; status: Status; expirationDate?: string; serviceType?: string }
export interface PaymentInfo { externalId: string; amount: number; currency: string; paymentDate?: string; status: string; method?: string }
export type Section<T> = { available: true; data: T } | { available: false };
export interface Profile {
  customer: Customer;
  services?: Section<ServiceInfo[]>;
  payments?: Section<PaymentInfo[]>;
  radius?: Section<{ enabled: boolean | null; online: boolean | null }>;
}
export interface Pending {
  id: string; action: string; state: string; currentStatus: Status; resultingStatus: Status; expiresAt: string;
  customer: { username: string; fullName?: string };
}
export interface Result { ok: boolean; message: string; replayed: boolean; state: string }
