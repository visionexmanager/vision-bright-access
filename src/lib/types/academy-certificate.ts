/**
 * Academy — Certificate System Types (Phase 6 architecture prep)
 * Extends AcademyCertificateRow (academy-modules.ts) with the template
 * system and verification audit trail the Phase 6 brief calls for.
 */

// ── Certificate Templates ─────────────────────────────────────────────────────
// Planned table: academy_certificate_templates
// Referenced by AcademyCertificateRow.template_id.

export interface AcademyCertificateTemplateRow {
  id: string;
  name: string;
  /** Accent color + layout variant — enough to render distinct-looking certificates client-side. */
  accent_color: string;
  layout: "classic" | "modern" | "minimal";
  logo_url: string | null;
  is_default: boolean;
}

// ── Verification Audit Trail ──────────────────────────────────────────────────
// Planned table: academy_certificate_verifications — append-only log of every
// lookup against the public verification page, so certificate issuers can
// later audit who checked a credential and when (tamper-proof structure prep:
// this log is never mutated, only appended to).

export interface AcademyCertificateVerificationRow {
  id: string;
  certificate_id: string;      // FK → AcademyCertificateRow.id
  certificate_number: string;  // denormalized for lookup-by-number auditing even if the cert is later deleted
  verified_at: string;
  result: "valid" | "revoked" | "not_found";
}
