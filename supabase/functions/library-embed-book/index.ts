/**
 * library-embed-book — admin/author-only manual (re)indexing trigger for
 * the RAG pipeline. Most books never need this called explicitly: every
 * AI mode already lazily indexes a book on its first request via
 * ensureBookIndexed() (_shared/libraryRag.ts). This exists for the cases
 * that need indexing NOW without waiting for a user-facing AI request —
 * e.g. an author corrected a chapter's text and wants search/chat to
 * reflect it immediately (forceReindex), or an admin wants to pre-warm a
 * newly published book.
 *
 * Auth: user-jwt required, caller must be admin OR own the book's author
 * profile (same ownership check as library-import-book). No rate limit —
 * admin/author-gated, not a per-user daily cap, matching how
 * library-import-book has never called check_ai_rate_limit either.
 *
 * Input: JSON { book_id: string, force_reindex?: boolean }
 * Returns: JSON { ok, indexed, chunk_count }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { ensureBookIndexed } from "../_shared/libraryRag.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
  force_reindex?: boolean;
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

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);

  try {
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
      userClient.rpc("is_library_book_owner", { _book_id: body.book_id }),
      userClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (!isOwner && !isAdmin) return json({ error: "You may only reindex your own books" }, 403, cors);

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const result = await ensureBookIndexed(serviceClient, body.book_id, { forceReindex: body.force_reindex ?? true });

    return json({ ok: true, indexed: result.indexed, chunk_count: result.chunkCount }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-embed-book error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
