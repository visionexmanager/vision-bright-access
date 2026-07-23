import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];
const ALLOWED_LANGS = new Set(["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"]);
const ALLOWED_TOPICS = new Set([
  "products", "services", "courses", "games", "tech-news", "global-news",
  "news-technology", "news-ai", "news-marketplace", "news-games", "news-academy",
  "news-health", "news-legal", "news-business", "news-travel", "news-beauty",
  "news-sports", "news-music", "news-psychology", "news-community",
  "news-accessibility", "news-entertainment", "news-nutrition", "news-platform",
  "news-world-economy", "news-world-politics",
]);

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: cors(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  let body: { action?: string; token?: string; topics?: unknown; lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid request" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return json(req, { error: "Invalid or expired management link" }, 400);
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: subscriber } = await db
    .from("newsletter_subscribers")
    .select("id, email, name, topics, lang")
    .eq("manage_token", token)
    .maybeSingle();

  if (!subscriber) return json(req, { error: "Invalid or expired management link" }, 404);

  if (body.action === "get") {
    const [local, domain = ""] = subscriber.email.split("@");
    const maskedEmail = `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
    return json(req, {
      subscriber: {
        email: maskedEmail,
        name: subscriber.name,
        topics: subscriber.topics ?? [],
        lang: subscriber.lang ?? "en",
      },
    });
  }

  if (body.action === "update") {
    if (!Array.isArray(body.topics) || body.topics.some((topic) => typeof topic !== "string" || !ALLOWED_TOPICS.has(topic))) {
      return json(req, { error: "Invalid interests" }, 400);
    }
    if (typeof body.lang !== "string" || !ALLOWED_LANGS.has(body.lang)) {
      return json(req, { error: "Invalid language" }, 400);
    }
    const topics = [...new Set(body.topics)].slice(0, ALLOWED_TOPICS.size);
    const { error } = await db
      .from("newsletter_subscribers")
      .update({ topics, lang: body.lang })
      .eq("id", subscriber.id);
    if (error) return json(req, { error: "Could not save preferences" }, 500);
    return json(req, { updated: true });
  }

  if (body.action === "unsubscribe") {
    const { error } = await db.from("newsletter_subscribers").delete().eq("id", subscriber.id);
    if (error) return json(req, { error: "Could not unsubscribe" }, 500);
    return json(req, { unsubscribed: true });
  }

  return json(req, { error: "Unsupported action" }, 400);
});

