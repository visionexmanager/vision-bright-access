import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type { AcademyDownload } from "@/features/visionkids/types/academy.types";

async function requireUserId(): Promise<string> {
  const { data } = await kidsDb.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Must be signed in");
  return id;
}

export async function logAcademyDownload(input: { lessonId?: string; worksheetId?: string; format: AcademyDownload["format"] }): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await kidsDb.from("kids_academy_downloads").insert({
    user_id, lesson_id: input.lessonId ?? null, worksheet_id: input.worksheetId ?? null, format: input.format,
  });
  if (error) throw error;
}

export async function fetchMyAcademyDownloads(): Promise<AcademyDownload[]> {
  const { data, error } = await kidsDb
    .from("kids_academy_downloads").select("*, lesson:kids_lessons(*), worksheet:kids_worksheets(*)")
    .order("downloaded_at", { ascending: false })
    .returns<AcademyDownload[]>();
  if (error) throw error;
  return data ?? [];
}
