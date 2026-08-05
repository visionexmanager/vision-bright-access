import { supabase } from "@/integrations/supabase/client";
import type { AgeGroup } from "@/features/visionkids/types/stories.types";

export interface AiTeacherTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskAiTeacherInput {
  question: string;
  ageGroup?: AgeGroup;
  language?: string;
  subject?: string;
  history?: AiTeacherTurn[];
}

export interface AiTeacherAnswer {
  answer: string;
  example: string;
  followUps: string[];
}

/**
 * Calls the kids-ai-teacher edge function.
 *
 * The API key lives in that function's environment (the same OPENAI_API_KEY
 * every other AI feature in this project uses) and never reaches the client —
 * a key shipped in the bundle is readable by anyone who opens the page.
 */
export async function askAiTeacher(input: AskAiTeacherInput): Promise<AiTeacherAnswer> {
  const { data, error } = await supabase.functions.invoke("kids-ai-teacher", {
    body: {
      question: input.question,
      ageGroup: input.ageGroup ?? "6-8",
      language: input.language ?? "en",
      subject: input.subject,
      history: input.history ?? [],
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return { answer: data.answer, example: data.example, followUps: data.followUps ?? [] };
}
