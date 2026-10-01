/**
 * Provider interfaces. The rest of the system depends only on these, so the
 * underlying ISP platform (PI/Proradius today) can be replaced without
 * touching the API, the admin UI or the WhatsApp controller.
 *
 * Deliberately absent: authenticateUser and updateUser. Nothing observed about
 * the PI system supports them, and a method is added only once it is.
 */
export type Status = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "TERMINATED" | "UNKNOWN";

export interface Customer {
  externalId: string;
  username: string;
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: Status;
}

export interface ServiceInfo {
  externalId: string;
  username: string;
  serviceType?: string;
  package?: string;
  speed?: string;
  status: Status;
  activationDate?: string;
  expirationDate?: string;
  suspensionDate?: string;
}

export interface PaymentInfo {
  externalId: string;
  amount: number;
  currency: string;
  paymentDate?: string;
  dueDate?: string;
  status: string;
  method?: string;
}

export interface RadiusStatus {
  username: string;
  enabled: boolean | null; // null = the source did not say
  online: boolean | null;
  lastSeen?: string;
}

/** Never carries a NAS address, shared secret or other infrastructure detail. */
export interface SessionInfo {
  sessionId: string;
  startedAt?: string;
  durationSeconds?: number;
  bytesIn?: number;
  bytesOut?: number;
}

export interface Page<T> {
  items: T[];
  truncated: boolean;
}

export interface CustomerProvider {
  search(query: string, limit: number): Promise<Page<Customer>>;
  /** Authoritative read straight from the source system. */
  get(externalId: string): Promise<Customer | null>;
}
export interface ServiceProvider {
  listForCustomer(externalId: string): Promise<ServiceInfo[]>;
}
export interface PaymentProvider {
  listForCustomer(externalId: string, limit: number): Promise<PaymentInfo[]>;
}
export interface RadiusProvider {
  getUser(username: string): Promise<{ username: string; enabled: boolean | null } | null>;
  getUserStatus(username: string): Promise<RadiusStatus>;
  getActiveSessions(username: string): Promise<SessionInfo[]>;
  enableUser(username: string): Promise<void>;
  disableUser(username: string): Promise<void>;
  disconnectSession(username: string, sessionId: string): Promise<void>;
}
export interface StatsProvider {
  /** Aggregate counters when the source exposes them; null when unavailable. */
  stats(): Promise<Record<string, number> | null>;
  expiring(withinDays: number, limit: number): Promise<Page<ServiceInfo & { customerId: string }>>;
}

export interface Providers {
  customers: CustomerProvider;
  services: ServiceProvider;
  payments: PaymentProvider;
  radius: RadiusProvider;
  stats: StatsProvider;
  /** Cheap reachability check for /system. */
  ping(): Promise<boolean>;
}

export interface WhatsAppProvider {
  sendText(to: string, text: string): Promise<void>;
  sendButtons(to: string, body: string, buttons: Button[]): Promise<void>;
  sendList(to: string, body: string, buttonLabel: string, rows: ListRow[]): Promise<void>;
  configured(): boolean;
}
export interface Button {
  id: string;
  title: string; // WhatsApp limit: 20 chars, max 3 buttons
}
export interface ListRow {
  id: string;
  title: string; // 24 chars
  description?: string; // 72 chars
}

export interface NotificationProvider {
  notifyOwners(message: string): Promise<void>;
}
