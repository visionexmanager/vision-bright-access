/**
 * library-generate-flashcard-deck — Learning Hub flashcards. Unlike the
 * lightweight reader-sidebar "flashcards" mode on library-ai-assistant
 * (which returns an ephemeral front/back batch the caller may or may not
 * save into library_ai_flashcards), this function generates a full STUDY
 * DECK grounded in the book/chapter's real content and persists it directly
 * into library_flashcard_decks + library_flashcards (SM-2 spaced-repetition
 * fields default to "due now", so a new deck is immediately studyable).
 *
 * Auth: user-jwt required, caller must be able to access the book's content
 * (can_access_library_book_content — same paywall rule as reading the book).
 * Input: JSON { book_id, chapter_id?, title?, card_count? (default 10, max 20) }
 * Returns: JSON { ok, deck_id, cards: LibraryFlashcardRow[] }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";
import { ensureBookIndexed, retrieveChunks, formatChunksAsContext } from "../_shared/libraryRag.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
  chapter_id?: string;
  title?: string;
  card_count?: number;
}

const DECK_SCHEMA = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["front", "back", "difficulty"],
        additionalProperties: false,
      },
    },
  },
  required: ["cards"],
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

  const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-generate-flashcard-deck" });
  if (allowed === false) return json({ error: "Daily limit reached. Try again tomorrow." }, 429, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const cardCount = Math.min(Math.max(body.card_count ?? 10, 3), 20);

  const { data: canAccess } = await userClient.rpc("can_access_library_book_content", { _book_id: body.book_id });
  if (!canAccess) return json({ error: "You don't have access to this book" }, 403, cors);

  try {
    const { data: book, error: bookErr } = await userClient
      .from("library_books").select("title").eq("id", body.book_id).maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);

    await ensureBookIndexed(serviceClient, body.book_id);
    const chunks = await retrieveChunks(
      userClient, body.book_id,
      "key facts, definitions, and concepts worth studying",
      { matchCount: 12, chapterId: body.chapter_id },
    );
    if (chunks.length === 0) {
      return json({ error: "This book has no indexable content yet" }, 400, cors);
    }
    const context = formatChunksAsContext(chunks);

    const result = await structuredCompletion({
      provider: "openai",
      model: "gpt-4o-mini",
      system: `You generate a study flashcard deck (front/back pairs) from a book's excerpts, faithfully testing genuine comprehension of the material. Tag each card's difficulty (easy/medium/hard) based on how much inference vs. recall it requires. Generate exactly ${cardCount} cards if the material supports it. Respond in the same language as the excerpts unless told otherwise.`,
      userText: context,
      schema: DECK_SCHEMA,
      toolName: "generate_flashcard_deck",
      maxTokens: 2500,
    }) as { cards: { front: string; back: string; difficulty: string }[] };

    if (!result.cards || result.cards.length === 0) {
      return json({ error: "Could not generate flashcards from this content" }, 500, cors);
    }

    const { data: deck, error: deckErr } = await userClient
      .from("library_flashcard_decks")
      .insert({
        user_id: user.id,
        book_id: body.book_id,
        chapter_id: body.chapter_id ?? null,
        title: body.title || `${book.title} — Flashcards`,
        is_ai_generated: true,
      })
      .select("id")
      .single();
    if (deckErr) throw deckErr;

    const rows = result.cards.map((c, i) => ({
      deck_id: deck.id,
      front: c.front,
      back: c.back,
      difficulty: c.difficulty,
      source: "ai",
      order_index: i,
    }));
    const { data: cards, error: cardsErr } = await userClient
      .from("library_flashcards").insert(rows).select("*");
    if (cardsErr) throw cardsErr;

    return json({ ok: true, deck_id: deck.id, cards }, 200, cors);
  } catch (err) {
    const msg = err instanceof ProviderError ? err.message : err instanceof Error ? err.message : String(err);
    console.error("library-generate-flashcard-deck error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
