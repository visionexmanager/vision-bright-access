import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { supabase } from "@/integrations/supabase/client";
import type { KidsCertificate, CertificateVerification } from "@/features/visionkids/types/academy.types";

export async function issueCourseCertificate(courseId: string): Promise<KidsCertificate> {
  const { data, error } = await supabase.functions.invoke("kids-issue-certificate", {
    body: { certificate_type: "course", reference_id: courseId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.certificate as KidsCertificate;
}

export async function fetchMyCertificates(): Promise<KidsCertificate[]> {
  const { data, error } = await kidsDb.from("kids_certificates").select("*").order("issued_at", { ascending: false }).returns<KidsCertificate[]>();
  if (error) throw error;
  return data ?? [];
}

export async function verifyCertificate(certificateNumber: string): Promise<CertificateVerification | null> {
  const { data, error } = await kidsDb.rpc("verify_kids_certificate", { _certificate_number: certificateNumber });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}
