// ─── Library — AI Narration Generation Service (Phase 7) ──────────────────
// Client wrapper for library-generate-narration, one call per chapter —
// same supabase.functions.invoke() pattern as purchases.ts/aiAssistant.ts
// (plain JSON in/out, no streaming needed here unlike library-ai-chat).

import { supabase } from "@/integrations/supabase/client";

export interface GenerateNarrationRequest {
  book_id: string;
  chapter_id: string;
  voice?: string;
  gender?: "male" | "female" | "neutral";
  dialect?: string;
  language?: string;
  speed?: number;
  emotion?: string;
}

export interface GenerateNarrationResult {
  ok: true;
  audiobook_id: string;
  chapter: {
    id: string;
    chapter_number: number;
    title: string | null;
    duration_seconds: number;
  };
}

export async function generateChapterNarration(req: GenerateNarrationRequest): Promise<GenerateNarrationResult> {
  const { data, error } = await supabase.functions.invoke("library-generate-narration", { body: req });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data as GenerateNarrationResult;
}
