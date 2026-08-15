/**
 * kids-course-generate — drafts a VisionKids academy course.
 *
 * The academy ships 22 subjects with almost nothing inside them. This turns a
 * subject into a complete draft course — units, lessons, lesson bodies — in one
 * structured-completion call through the shared aiProvider, using the same
 * mechanism as kids-story-generate.
 *
 * Two rules shape everything here:
 *
 * 1. **Nothing reaches a child unreviewed.** Every row is written with
 *    status 'draft' and published_at null. This function has no code path that
 *    publishes; a human promotes a draft after reading it. Generated material
 *    for children can be subtly wrong in ways an automated check will not catch,
 *    and the cost of being wrong is paid by a child, so the gate is a person.
 *
 * 2. **Authoring is an admin action, not a child's.** It requires an admin
 *    role, unlike kids-story-generate which any signed-in user may call for
 *    their own story.
 *
 * Providers are tried in order and the first valid structured result wins, so a
 * single provider outage or a model that has quietly stopped serving does not
 * fail authoring. The provider that answered is returned, because "which model
 * wrote this" is part of reviewing it.
 *
 * Input:  { subjectSlug, ageRange?: "3-5"|"6-8"|"9-12", language?, topic? }
 * Output: { courseId, slug, title, unitCount, lessonCount, provider, model }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletionWithFallback, ProviderError, type ProviderTarget } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

type AgeRange = "3-5" | "6-8" | "9-12";

const AGE_STYLE: Record<AgeRange, string> = {
  "3-5": "Ages 3-5: one idea per lesson, very short sentences, concrete everyday objects, nothing abstract.",
  "6-8": "Ages 6-8: short paragraphs, familiar examples, a single new term per lesson explained in plain words.",
  "9-12": "Ages 9-12: fuller explanations, a worked example per lesson, correct terminology introduced explicitly.",
};

/**
 * Order matters. OpenAI first for schema adherence, then the two
 * OpenAI-dialect providers, then Gemini last because it speaks its own dialect
 * and is the one historically most likely to 404 on a listed model.
 */
const PROVIDER_TARGETS: ProviderTarget[] = [
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "groq", model: "llama-3.3-70b-versatile" },
  { provider: "mistral", model: "mistral-large-latest" },
  { provider: "gemini", model: "gemini-2.0-flash" },
];

const COURSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    description: { type: "string" },
    difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    units: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          lessons: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                content: { type: "string", description: "The lesson body in markdown, 120-400 words." },
                estimatedMinutes: { type: "integer", minimum: 3, maximum: 30 },
              },
              required: ["title", "description", "content", "estimatedMinutes"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "description", "lessons"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "subtitle", "description", "difficulty", "units"],
  additionalProperties: false,
} as const;

interface GeneratedCourse {
  title: string;
  subtitle: string;
  description: string;
  difficulty: string;
  units: Array<{
    title: string;
    description: string;
    lessons: Array<{ title: string; description: string; content: string; estimatedMinutes: number }>;
  }>;
}

/** ASCII slug with a short random suffix so re-running never collides. */
function slugify(title: string) {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `${base || "course"}-${crypto.randomUUID().slice(0, 6)}`;
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

  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (isAdmin !== true) return json({ error: "Admin role required" }, 403, cors);

  let body: { subjectSlug?: string; ageRange?: AgeRange; language?: string; topic?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const subjectSlug = body.subjectSlug?.trim();
  if (!subjectSlug) return json({ error: "subjectSlug is required" }, 400, cors);
  if (body.topic && body.topic.length > 200) return json({ error: "topic is too long (max 200 characters)" }, 400, cors);

  const ageRange: AgeRange = body.ageRange && AGE_STYLE[body.ageRange] ? body.ageRange : "6-8";
  const language = body.language || "en";

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: subject } = await service
    .from("kids_subjects")
    .select("id, name, slug")
    .eq("slug", subjectSlug)
    .maybeSingle();
  if (!subject) return json({ error: `Unknown subject: ${subjectSlug}` }, 404, cors);

  const system = [
    "You write curriculum for VisionKids, a children's learning platform.",
    AGE_STYLE[ageRange],
    "Everything you state must be factually correct; if a fact is disputed or you are unsure, leave it out rather than simplify it into something false.",
    "Write only original material. Do not reproduce copyrighted text, song lyrics, or passages from published books.",
    "Keep it safe, kind and free of anything frightening, violent or commercial.",
    `Write every field in this language: ${language}.`,
  ].join(" ");

  const focus = body.topic?.trim()
    ? `Focus the course on: "${body.topic.trim()}".`
    : "Cover the foundations of the subject for this age group.";

  let generated: GeneratedCourse;
  let provider: string;
  let model: string;
  try {
    const outcome = await structuredCompletionWithFallback({
      targets: PROVIDER_TARGETS,
      system,
      userText: `Write a complete beginner course for the subject "${subject.name}". ${focus}`,
      schema: COURSE_SCHEMA as unknown as Record<string, unknown>,
      toolName: "generate_kids_course",
      maxTokens: 6000,
    });
    generated = outcome.result as GeneratedCourse;
    provider = outcome.provider;
    model = outcome.model;
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : "Course generation failed" }, status, cors);
  }

  const lessonTotal = generated.units.reduce((sum, unit) => sum + unit.lessons.length, 0);

  // status 'draft' / published_at null is the review gate. Nothing below sets
  // either to a published value.
  const { data: course, error: courseErr } = await service
    .from("kids_courses")
    .insert({
      subject_id: subject.id,
      slug: slugify(generated.title),
      title: generated.title,
      subtitle: generated.subtitle,
      description: generated.description,
      difficulty: generated.difficulty,
      age_range: ageRange,
      lesson_count: lessonTotal,
      status: "draft",
      published_at: null,
    })
    .select("id, slug")
    .single();
  if (courseErr || !course) return json({ error: courseErr?.message ?? "Could not save the course" }, 500, cors);

  for (const [unitIndex, unit] of generated.units.entries()) {
    const { data: unitRow, error: unitErr } = await service
      .from("kids_units")
      .insert({ course_id: course.id, title: unit.title, description: unit.description, order_index: unitIndex })
      .select("id")
      .single();
    if (unitErr || !unitRow) return json({ error: unitErr?.message ?? "Could not save a unit" }, 500, cors);

    const lessons = unit.lessons.map((lesson, lessonIndex) => ({
      course_id: course.id,
      unit_id: unitRow.id,
      slug: slugify(lesson.title),
      title: lesson.title,
      description: lesson.description,
      content: lesson.content,
      estimated_minutes: lesson.estimatedMinutes,
      order_index: unitIndex * 100 + lessonIndex,
      status: "draft",
    }));
    const { error: lessonErr } = await service.from("kids_lessons").insert(lessons);
    if (lessonErr) return json({ error: lessonErr.message }, 500, cors);
  }

  return json(
    {
      courseId: course.id,
      slug: course.slug,
      title: generated.title,
      unitCount: generated.units.length,
      lessonCount: lessonTotal,
      status: "draft",
      provider,
      model,
    },
    200,
    cors
  );
});
