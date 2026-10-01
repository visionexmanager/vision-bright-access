export type Role = "SUPER_ADMIN" | "ADMIN" | "WHATSAPP_ADMIN" | "READ_ONLY_ADMIN";

export type Permission =
  | "customer:read"
  | "service:read"
  | "payment:read"
  | "radius:read"
  | "audit:read"
  | "system:read"
  | "service:suspend"
  | "service:resume"
  | "service:activate"
  | "service:terminate"
  | "admin:manage"
  | "whatsapp_admin:manage"
  | "killswitch:manage";

const READS: Permission[] = ["customer:read", "service:read", "payment:read", "radius:read"];
const WRITES: Permission[] = ["service:suspend", "service:resume", "service:activate"];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set<Permission>([
    ...READS,
    ...WRITES,
    "audit:read",
    "system:read",
    "service:terminate",
    "admin:manage",
    "whatsapp_admin:manage",
    "killswitch:manage",
  ]),
  ADMIN: new Set<Permission>([...READS, ...WRITES, "audit:read", "system:read"]),
  WHATSAPP_ADMIN: new Set<Permission>([...READS, ...WRITES]),
  READ_ONLY_ADMIN: new Set<Permission>([...READS, "system:read"]),
};

export const can = (role: Role, p: Permission): boolean => MATRIX[role]?.has(p) ?? false;
export const isRole = (v: unknown): v is Role => typeof v === "string" && v in MATRIX;

export type ServiceAction = "SUSPEND" | "RESUME" | "ACTIVATE" | "TERMINATE";
export const ACTION_PERMISSION: Record<ServiceAction, Permission> = {
  SUSPEND: "service:suspend",
  RESUME: "service:resume",
  ACTIVATE: "service:activate",
  TERMINATE: "service:terminate",
};
