/**
 * news-translate — the website's counterpart of the WhatsApp news translation.
 *
 * The daily collection stores each article in English only, so every reader
 * whose language is not English saw English. This translates the missing
 * language once per article and writes it back to `news_articles.translations`
 * (the same column the WhatsApp assistant fills), so the next reader costs
 * nothing.
 *
 * Input:  { language, ids: string[] }  — ids are looked up server-side; the
 *         caller never supplies the text that is translated.
 * Output: { translations: { [id]: { title, description } } }
 * Auth:   the project's default JWT check (the site's anon key passes).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { chainProvider } from "../_shared/whatsappAskProvider.ts";
import { withTranslations, NEWS_TRANSLATE_LIMIT } from "../_shared/whatsappNewsTranslate.ts";
import { isSupportedLanguage, LANGUAGE_ENDONYM } from "../_shared/whatsappLanguages.ts";
import type { NewsArticle } from "../_shared/whatsappNews.ts";

const json = (data: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  let body: { language?: unknown; ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const language = typeof body.language === "string" ? body.language : "";
  if (!isSupportedLanguage(language)) return json({ error: "Unsupported language" }, 400, cors);
  if (language === "en") return json({ translations: {} }, 200, cors);

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)).slice(0, NEWS_TRANSLATE_LIMIT)
    : [];
  if (ids.length === 0) return json({ translations: {} }, 200, cors);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db
    .from("news_articles")
    .select("id, title, description, category, published_at, translations")
    .eq("published", true)
    .in("id", ids);
  if (error || !data) return json({ translations: {} }, 200, cors);

  const articles: NewsArticle[] = data.map((r) => ({
    id: r.id,
    title: r.title ?? "",
    description: r.description ?? "",
    category: r.category,
    publishedAt: r.published_at,
    translations: (r.translations as NewsArticle["translations"]) ?? null,
  }));

  const translated = await withTranslations({
    articles,
    language,
    languageName: LANGUAGE_ENDONYM[language],
    provider: chainProvider(),
    save: async (id, translations) => {
      await db.from("news_articles").update({ translations }).eq("id", id);
    },
  });

  const out: Record<string, { title: string; description: string }> = {};
  for (const a of translated) {
    const t = a.translations?.[language];
    if (t?.title) out[a.id] = { title: t.title, description: t.description ?? "" };
  }
  return json({ translations: out }, 200, cors);
});
