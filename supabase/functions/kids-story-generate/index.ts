/**
 * kids-story-generate — VisionKids AI Story Generator.
 *
 * A child types an idea ("a lion who travels to space"); this returns a
 * complete short story (pages of text), a cast of characters, a moral
 * lesson, a short vocabulary list, and a small multiple-choice quiz — all
 * in one structured-completion call via the shared aiProvider (same
 * mechanism as library-ai-assistant, see that function's header). A cover
 * image is generated best-effort via DALL·E (same provider as the existing
 * image-generate function) and never fails the whole request if it errors —
 * a story without a cover is still a usable story.
 *
 * Auth: user-jwt required. Rate-limited via check_ai_rate_limit (falls into
 * the generic 30/day bucket — no bespoke entry needed there).
 *
 * NOT included in this pass: AI-generated audio narration. The platform has
 * a text-to-speech function, but it's built around fixed assistant personas
 * (voice/style pairs) rather than general narration, and wiring a new one
 * cleanly (voice choice, storage of the resulting file, a stable URL) is a
 * separate, well-scoped follow-up rather than something to bolt on here.
 *
 * Input: JSON { prompt: string, ageGroup?: "3-5"|"6-8"|"9-12", language?: string }
 * Returns: JSON { title, pages, characters, moralLesson, vocabulary, quiz, coverImageUrl }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  prompt: string;
  ageGroup?: "3-5" | "6-8" | "9-12";
  language?: string;
}

interface GeneratedStory {
  title: string;
  pages: { text: string }[];
  characters: { name: string; description: string }[];
  moralLesson: string;
  vocabulary: { word: string; meaning: string }[];
  quiz: { question: string; options: string[]; correctAnswer: string }[];
}

const STORY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    pages: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false },
    },
    characters: {
      type: "array",
      maxItems: 5,
      items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name", "description"], additionalProperties: false },
    },
    moralLesson: { type: "string" },
    vocabulary: {
      type: "array",
      maxItems: 6,
      items: { type: "object", properties: { word: { type: "string" }, meaning: { type: "string" } }, required: ["word", "meaning"], additionalProperties: false },
    },
    quiz: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
          correctAnswer: { type: "string" },
        },
        required: ["question", "options", "correctAnswer"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "pages", "characters", "moralLesson", "vocabulary", "quiz"],
  additionalProperties: false,
};

const AGE_STYLE: Record<string, string> = {
  "3-5": "Use extremely simple words, very short sentences (5-8 words), and a gentle, soothing tone suitable for a 3-5 year old.",
  "6-8": "Use simple, clear vocabulary and short sentences suitable for a 6-8 year old just becoming a confident reader.",
  "9-12": "Use richer vocabulary and slightly longer sentences suitable for a 9-12 year old, while staying fully age-appropriate.",
};

async function generateCoverImage(prompt: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `A warm, colorful, child-friendly storybook illustration (no text or words in the image) of: ${prompt}. Whimsical, soft, safe-for-kids art style.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
        response_format: "url",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "kids-story-generate" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  if (!body.prompt?.trim()) return json({ error: "prompt is required" }, 400, cors);
  if (body.prompt.length > 300) return json({ error: "prompt is too long (max 300 characters)" }, 400, cors);

  const ageGroup = body.ageGroup && AGE_STYLE[body.ageGroup] ? body.ageGroup : "6-8";
  const language = body.language || "en";

  const system = [
    "You are a gentle, imaginative children's story writer for the VisionKids platform.",
    AGE_STYLE[ageGroup],
    "The story must be wholesome, safe, non-violent, and end on a positive, comforting note.",
    "Never include anything scary, violent, sad-without-resolution, or inappropriate for children.",
    `Write the story, characters, moral lesson, vocabulary, and quiz in this language: ${language}.`,
    "The quiz must have exactly one correct answer per question, and correctAnswer must exactly match one of the options.",
  ].join(" ");

  try {
    const result = (await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system,
      userText: `Write a children's story based on this idea: "${body.prompt.trim()}"`,
      schema: STORY_SCHEMA,
      toolName: "generate_kids_story",
      maxTokens: 2500,
    })) as GeneratedStory;

    const coverImageUrl = await generateCoverImage(`${result.title}. ${body.prompt.trim()}`);

    return json(
      {
        title: result.title,
        pages: result.pages,
        characters: result.characters,
        moralLesson: result.moralLesson,
        vocabulary: result.vocabulary,
        quiz: result.quiz,
        coverImageUrl,
      },
      200,
      cors
    );
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : "Story generation failed" }, status, cors);
  }
});
