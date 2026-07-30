import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { TalentCertificate } from "@/features/visionkids/types/talent.types";

export async function fetchMyTalentCertificate(): Promise<TalentCertificate | null> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_certificates").select("*").eq("user_id", userId).eq("certificate_type", "talent").maybeSingle()
    .returns<TalentCertificate>();
  if (error) throw error;
  return data ?? null;
}

/** Claims the Talent Hub certificate via the signing edge function — only
 *  succeeds server-side once a full track is finished or 5+ skills mastered. */
export async function claimTalentCertificate(): Promise<TalentCertificate> {
  const { data, error } = await supabase.functions.invoke("kids-issue-certificate", {
    body: { certificate_type: "talent" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.certificate as TalentCertificate;
}
