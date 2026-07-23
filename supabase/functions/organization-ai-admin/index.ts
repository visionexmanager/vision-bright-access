/**
 * organization-ai-admin — AI features FOR administrators of an Enterprise
 * Platform organization. Two modes are genuinely LLM-backed
 * (content_recommendations reasoning, training_plan); duplicate_detection is
 * deterministic (title/ISBN normalization, no LLM needed — matches this
 * app's "don't call an LLM for what's really a string comparison"
 * precedent). Automatic Classification and Smart Search are NOT
 * reimplemented here — they reuse the existing library-ai-classify-book and
 * library-ai-search functions directly from the client, since an org admin
 * classifying/searching the shared catalog needs exactly what those
 * functions already do.
 *
 * Auth: user-jwt required, caller must be an admin of the given
 * organization_id (checked via is_organization_admin).
 * Input: JSON { organization_id, mode: "content_recommendations"|"training_plan"|"duplicate_detection", group_id? }
 * Returns: JSON { ok, result } (shape depends on mode)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

interface RequestBody {
  organization_id: string;
  mode: "content_recommendations" | "training_plan" | "duplicate_detection";
  group_id?: string;
}

const TRAINING_PLAN_SCHEMA = {
  type: "object",
  properties: {
    plan_summary: { type: "string" },
    weekly_focus: { type: "array", maxItems: 6, items: { type: "string" } },
    recommended_resource_titles: { type: "array", maxItems: 8, items: { type: "string" } },
  },
  required: ["plan_summary", "weekly_focus", "recommended_resource_titles"],
  additionalProperties: false,
};

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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.organization_id || !body.mode) return json({ error: "organization_id and mode are required" }, 400, cors);

  const { data: isAdmin } = await userClient.rpc("is_organization_admin", { _organization_id: body.organization_id });
  if (!isAdmin) return json({ error: "Not authorized for this organization" }, 403, cors);

  try {
    if (body.mode === "duplicate_detection") {
      const { data: resources } = await userClient
        .from("organization_resources").select("id, title, book_id").eq("organization_id", body.organization_id);

      const groups = new Map<string, { id: string; title: string }[]>();
      for (const r of resources ?? []) {
        const key = r.book_id ? `book:${r.book_id}` : `title:${normalizeTitle(r.title)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ id: r.id, title: r.title });
      }
      const duplicates = [...groups.values()].filter((g) => g.length > 1);
      return json({ ok: true, result: { duplicate_groups: duplicates } }, 200, cors);
    }

    const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "organization-ai-admin" });
    if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

    if (body.mode === "content_recommendations") {
      const { data: org } = await userClient.from("organizations").select("name, org_type").eq("id", body.organization_id).maybeSingle();
      const { data: existingResources } = await userClient
        .from("organization_resources").select("book_id, library_books(title)").eq("organization_id", body.organization_id).not("book_id", "is", null);
      const existingTitles = ((existingResources ?? []) as unknown as Array<{ library_books: { title: string } | null }>)
        .map((r) => r.library_books?.title).filter(Boolean);

      const { data: popular } = await userClient.rpc("get_organization_popular_books", { _organization_id: body.organization_id, _limit: 10 });

      const userText = [
        `Organization type: ${org?.org_type ?? "organization"}.`,
        existingTitles.length > 0 ? `Already in the course library: ${existingTitles.join(", ")}.` : "Course library is currently empty.",
        popular && popular.length > 0 ? `Most-read books by members: ${(popular as Array<{ title: string }>).map((p) => p.title).join(", ")}.` : "",
      ].filter(Boolean).join("\n");

      const result = await structuredCompletion({
        provider: "openai", model: "gpt-4o-mini",
        system: `You advise an administrator of a ${org?.org_type ?? "organization"} on which kinds of books/resources to add to their private course library, based on what members already read and what's already curated. Suggest general topics/genres, not fabricated exact titles that may not exist in the catalog.`,
        userText,
        schema: { type: "object", properties: { summary: { type: "string" }, suggested_topics: { type: "array", maxItems: 8, items: { type: "string" } } }, required: ["summary", "suggested_topics"], additionalProperties: false },
        toolName: "recommend_organization_content",
        maxTokens: 600,
      });
      return json({ ok: true, result }, 200, cors);
    }

    if (body.mode === "training_plan") {
      if (!body.group_id) return json({ error: "group_id is required for training_plan" }, 400, cors);
      const { data: group } = await userClient.from("organization_groups").select("name, group_type").eq("id", body.group_id).maybeSingle();
      const { data: training } = await userClient.rpc("get_organization_training_completion", { _organization_id: body.organization_id });

      const userText = [
        `Group: ${group?.name ?? "Unknown"} (${group?.group_type ?? "group"}).`,
        training && training.length > 0
          ? `Current assignment completion: ${(training as Array<{ title: string; assigned_count: number; completed_count: number }>).map((t) => `${t.title} (${t.completed_count}/${t.assigned_count})`).join(", ")}.`
          : "No assignments tracked yet for this organization.",
      ].join("\n");

      const result = await structuredCompletion({
        provider: "openai", model: "gpt-4o-mini",
        system: "You design a short training plan for a group within an organization's learning library, based on their current assignment completion data. Produce a plan summary, up to 6 weekly focus items, and up to 8 general recommended resource topics (not fabricated exact titles).",
        userText,
        schema: TRAINING_PLAN_SCHEMA,
        toolName: "generate_training_plan",
        maxTokens: 800,
      });
      return json({ ok: true, result }, 200, cors);
    }

    return json({ error: "Invalid mode" }, 400, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("organization-ai-admin error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
