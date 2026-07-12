// ─── Career Center — Certificates Service (Phase 1 backend) ──────────────────
// Table: certificates. RLS: owner sees own (+ anyone can see verified ones).

import { supabase } from "@/integrations/supabase/client";
import type { CertificateRow } from "@/lib/types/career";

export async function fetchMyCertificates(userId: string): Promise<CertificateRow[]> {
  const { data, error } = await (supabase.from("certificates") as any)
    .select("*")
    .eq("user_id", userId)
    .order("issue_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CertificateRow[];
}

export interface NewCertificate {
  title: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  credential_id?: string;
  credential_url?: string;
}

export async function addCertificate(userId: string, cert: NewCertificate): Promise<CertificateRow> {
  const { data, error } = await (supabase.from("certificates") as any)
    .insert({ user_id: userId, ...cert })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CertificateRow;
}

export async function deleteCertificate(certificateId: string): Promise<void> {
  const { error } = await (supabase.from("certificates") as any).delete().eq("id", certificateId);
  if (error) throw new Error(error.message);
}
