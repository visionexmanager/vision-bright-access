/**
 * Public contact departments for /contact.
 *
 * These four addresses are published on the page by design — they are the
 * advertised way to reach Visionex, so they belong in the bundle.
 *
 * Internal mailboxes (admin@ and individual staff addresses) are deliberately
 * absent. Internal notification goes out server-side in the contact-form edge
 * function, from the CONTACT_INTERNAL_RECIPIENTS secret, so those addresses
 * never reach the browser or the repository.
 *
 * The same ids are validated in supabase/functions/_shared/contactRouting.ts.
 * Adding a department means adding it in both places.
 */
export const CONTACT_DEPARTMENTS = [
  { id: "general", email: "hello@visionex.app", labelKey: "contact.deptGeneral" },
  { id: "support", email: "support@visionex.app", labelKey: "contact.deptSupport" },
  { id: "billing", email: "billing@visionex.app", labelKey: "contact.deptBilling" },
  { id: "news", email: "news@visionex.app", labelKey: "contact.deptNews" },
] as const;

export type ContactDepartment = (typeof CONTACT_DEPARTMENTS)[number];
export type ContactDepartmentId = ContactDepartment["id"];

/** Catch-all when the sender does not pick one. */
export const DEFAULT_DEPARTMENT: ContactDepartmentId = "general";

export function isContactDepartmentId(value: unknown): value is ContactDepartmentId {
  return typeof value === "string" && CONTACT_DEPARTMENTS.some((d) => d.id === value);
}
