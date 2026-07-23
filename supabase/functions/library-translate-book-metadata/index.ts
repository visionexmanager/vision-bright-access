/**
 * library-translate-book-metadata — AI-translates a book's title/subtitle/
 * description/keywords into another of the app's 11 supported languages,
 * upserting into library_book_translations. The book's own `language`
 * column is always the original and is never overwritten — this is purely
 * an additive overlay the frontend reads when the viewer's locale differs
 * from the book's original language, falling back to the original if no
 * translation exists yet.
 *
 * Auth: user-jwt required, caller must be able to edit the book (author/
 * collaborator/admin) — translating metadata is an authoring action, same
 * authorization shape as library-ai-classify-book.
 * Input: JSON { book_id, target_language }
 * Returns: JSON { ok, translation }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
  target_language: string;
}

const SUPPORTED_LANGUAGES = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", ar: "Arabic", es: "Spanish", de: "German", pt: "Portuguese",
  zh: "Chinese (Simplified)", tr: "Turkish", fr: "French", ru: "Russian", ur: "Urdu", hi: "Hindi",
};

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: ["string", "null"] },
    description: { type: "string" },
    description_long: { type: ["string", "null"] },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["title", "subtitle", "description", "description_long", "keywords"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-translate-book-metadata" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  if (!SUPPORTED_LANGUAGES.includes(body.target_language)) return json({ error: `Unsupported target_language "${body.target_language}"` }, 400, cors);

  const { data: canEdit } = await userClient.rpc("can_edit_library_book", { _book_id: body.book_id });
  if (!canEdit) return json({ error: "You don't have access to this book" }, 403, cors);

  try {
    const { data: book, error: bookErr } = await userClient
      .from("library_books")
      .select("id, title, subtitle, description, description_long, keywords, language")
      .eq("id", body.book_id)
      .maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);
    if (book.language === body.target_language) return json({ error: "This is already the book's original language" }, 400, cors);

    const userText = [
      `Title: ${book.title}`,
      book.subtitle ? `Subtitle: ${book.subtitle}` : "",
      `Description: ${book.description}`,
      book.description_long ? `Long description: ${book.description_long}` : "",
      book.keywords?.length ? `Keywords: ${book.keywords.join(", ")}` : "",
    ].filter(Boolean).join("\n").slice(0, 6000);

    const targetName = LANGUAGE_NAMES[body.target_language] ?? body.target_language;
    const translation = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `You translate book catalog metadata into ${targetName}, faithfully and naturally — not word-for-word, but preserving meaning, tone, and marketing intent. Keep proper nouns (character/place names, series titles) unchanged unless they have a well-established localized form.`,
      userText,
      schema: TRANSLATION_SCHEMA,
      toolName: "translate_book_metadata",
      maxTokens: 1200,
    }) as { title: string; subtitle: string | null; description: string; description_long: string | null; keywords: string[] };

    const { data: row, error: upsertErr } = await userClient
      .from("library_book_translations")
      .upsert({
        book_id: body.book_id,
        language_code: body.target_language,
        title: translation.title,
        subtitle: translation.subtitle,
        description: translation.description,
        description_long: translation.description_long,
        keywords: translation.keywords,
        translated_by: "ai",
      }, { onConflict: "book_id,language_code" })
      .select("*")
      .single();
    if (upsertErr) throw upsertErr;

    return json({ ok: true, translation: row }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-translate-book-metadata error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
