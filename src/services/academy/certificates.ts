// ─── Academy — Certificate System Service Stubs (Phase 6 architecture prep) ──
// Placeholder implementations — the real logic runs against
// src/lib/academy/certificateLocalStore.ts today (eligibility checks,
// unique certificate numbers, verification lookups + audit log).

import type { AcademyCertificateRow } from "@/lib/types/academy-modules";
import type { AcademyCertificateTemplateRow, AcademyCertificateVerificationRow } from "@/lib/types/academy-certificate";

export interface CertificateEligibility {
  eligible: boolean;
  reasons: string[]; // human-readable blockers when not eligible
}

export async function checkCertificateEligibility(userId: string, courseId: string): Promise<CertificateEligibility> {
  void userId;
  void courseId;
  return { eligible: false, reasons: [] };
}

export async function issueCertificate(userId: string, courseId: string): Promise<AcademyCertificateRow | null> {
  void userId;
  void courseId;
  return null;
}

export async function fetchMyCertificates(userId: string): Promise<AcademyCertificateRow[]> {
  void userId;
  return [];
}

export async function fetchCertificateByNumber(certificateNumber: string): Promise<AcademyCertificateRow | null> {
  void certificateNumber;
  return null;
}

export async function verifyCertificate(certificateNumber: string): Promise<AcademyCertificateVerificationRow | null> {
  void certificateNumber;
  return null;
}

export async function revokeCertificate(certificateId: string, adminUserId: string): Promise<boolean> {
  void certificateId;
  void adminUserId;
  return false;
}

export async function fetchCertificateTemplates(): Promise<AcademyCertificateTemplateRow[]> {
  return [];
}
