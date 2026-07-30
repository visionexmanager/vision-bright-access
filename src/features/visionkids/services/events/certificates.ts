import { supabase } from "@/integrations/supabase/client";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { KidsEventCertificate } from "@/features/visionkids/types/events.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function fetchMyEventCertificates(): Promise<KidsEventCertificate[]> {
  const userId = await requireUserId();
  const { data, error } = await kidsDb
    .from("kids_certificates").select("*").eq("user_id", userId)
    .in("certificate_type", ["event_participation", "event_winner"])
    .order("issued_at", { ascending: false })
    .returns<KidsEventCertificate[]>();
  if (error) throw error;
  return data ?? [];
}

export async function claimEventCertificate(eventId: string, type: "event_participation" | "event_winner"): Promise<KidsEventCertificate> {
  const { data, error } = await supabase.functions.invoke("kids-issue-certificate", {
    body: { certificate_type: type, reference_id: eventId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.certificate as KidsEventCertificate;
}
