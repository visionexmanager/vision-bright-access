/**
 * kids-drawing-to-art — VisionKids Drawing Studio "AI-ify my drawing".
 *
 * Two-step pipeline, both reusing existing shared infra rather than a new
 * bespoke vision system: (1) structuredCompletion() with a vision-capable
 * model describes what the child drew (aiProvider.ts — same mechanism as
 * library-ai-assistant's image-description mode), then (2) that
 * description becomes a DALL·E prompt for a stylized version (same
 * provider call as the image-generate function, inlined here rather than
 * calling that function-to-function, since it needs the description this
 * function just produced).
 *
 * Auth: user-jwt required. Rate-limited via check_ai_rate_limit (generic
 * 30/day bucket).
 *
 * Input: JSON { image: string (data URL) }
 * Returns: JSON { description, imageUrl }
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  image: string;
}

async function generateStylizedImage(description: string): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `A warm, colorful, child-friendly storybook illustration (no text or words) turning this child's drawing into a polished piece of art: ${description}. Whimsical, soft, safe-for-kids art style.`,
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
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "kids-drawing-to-art" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.image?.startsWith("data:image")) return json({ error: "image (data URL) is required" }, 400, cors);

  try {
    const result = (await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: "You describe a child's drawing plainly and kindly in 1-2 sentences, mentioning the main subjects, colors, and shapes you see. This description will be used to create a polished piece of art inspired by the drawing.",
      userText: "Describe this child's drawing.",
      image: body.image,
      schema: { type: "object", properties: { description: { type: "string" } }, required: ["description"], additionalProperties: false },
      toolName: "describe_drawing",
      maxTokens: 300,
    })) as { description: string };

    const imageUrl = await generateStylizedImage(result.description);
    if (!imageUrl) return json({ error: "Could not generate the stylized image right now" }, 502, cors);

    return json({ description: result.description, imageUrl }, 200, cors);
  } catch (err) {
    const status = err instanceof ProviderError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : "Could not process the drawing" }, status, cors);
  }
});
