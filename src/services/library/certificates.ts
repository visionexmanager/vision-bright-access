// ─── Library — Learning Hub: Certificates ──────────────────────────────────
// Issuance goes through the library-issue-certificate edge function (service
// role, eligibility-checked, HMAC-signed) — this file only reads.

import { supabase } from "@/integrations/supabase/client";
import type { LibraryCertificateRow, LibraryCertificateType, LibraryCertificateVerification } from "@/lib/types/library-learning";

export async function fetchMyCertificates(userId: string): Promise<LibraryCertificateRow[]> {
  const { data, error } = await supabase.from("library_certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryCertificateRow[];
}

export async function issueCertificate(certificateType: LibraryCertificateType, referenceId: string): Promise<LibraryCertificateRow> {
  const { data, error } = await supabase.functions.invoke("library-issue-certificate", {
    body: { certificate_type: certificateType, reference_id: referenceId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data.certificate as LibraryCertificateRow;
}

export async function verifyCertificate(certificateNumber: string): Promise<LibraryCertificateVerification | null> {
  const { data, error } = await supabase.rpc("verify_library_certificate", { _certificate_number: certificateNumber });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? null) as LibraryCertificateVerification | null;
}
