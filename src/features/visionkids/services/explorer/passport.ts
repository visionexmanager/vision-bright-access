import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { PassportStamp } from "@/features/visionkids/types/explorer.types";

export async function fetchMyPassportStamps(): Promise<PassportStamp[]> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_explorer_passport_stamps").select("*").eq("user_id", userId).order("stamped_at")
    .returns<PassportStamp[]>();
  if (error) throw error;
  return data ?? [];
}

/** Idempotent — safe to call every time a world's page mounts. XP/coins/
 *  achievements are only granted the first time (enforced server-side in
 *  the award_kids_explorer_stamp() function itself). Returns true only if
 *  this call newly stamped the world (false on repeat visits). */
export async function stampWorld(worldSlug: string): Promise<boolean> {
  const { data, error } = await kidsDb.rpc("award_kids_explorer_stamp", { _world_slug: worldSlug });
  if (error) throw error;
  return !!data;
}

export interface ExplorerCertificate {
  id: string;
  certificate_number: string;
  verification_code: string;
  title: string;
  recipient_name: string;
  issuer_name: string;
  issued_at: string;
}

export async function fetchMyExplorerCertificate(): Promise<ExplorerCertificate | null> {
  const { data: authData } = await kidsDb.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return null;
  const { data, error } = await kidsDb
    .from("kids_certificates").select("*").eq("user_id", userId).eq("certificate_type", "explorer").maybeSingle()
    .returns<ExplorerCertificate>();
  if (error) throw error;
  return data ?? null;
}

export async function claimExplorerCertificate(): Promise<ExplorerCertificate> {
  const { data, error } = await supabase.functions.invoke("kids-issue-certificate", {
    body: { certificate_type: "explorer" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.certificate as ExplorerCertificate;
}
