/**
 * library-purchase-book — the one real gap Phase 4 left as a placeholder
 * toast: a signed-in user's own client can INSERT a library_purchases row
 * but only with status='pending' (20260720000002_library_core_commerce_
 * gamification.sql deliberately blocks a buyer from marking their own
 * purchase paid — that's admin/service-role-only). This function is the
 * trusted server step: call the existing spend_vx RPC (already enforces
 * balance/whitelisting) as the calling user, and ONLY on success, use the
 * service-role client to insert a completed purchase row directly.
 *
 * USD/Stripe checkout stays out of scope — no Stripe integration exists
 * anywhere in the Library feature. This is VX-only, and it's real.
 *
 * Auth: user-jwt required
 * Input: JSON { book_id }
 * Returns: JSON { ok, purchase }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  book_id: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

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
    // RLS-scoped read — only returns the book if it's actually visible to
    // this caller (published, or owner/admin), same trust boundary as
    // every other user-facing query in this feature.
    const { data: book, error: bookErr } = await userClient
      .from("library_books")
      .select("id, title, is_free, price_vx, publish_status")
      .eq("id", body.book_id)
      .maybeSingle();
    if (bookErr) throw bookErr;
    if (!book) return json({ error: "Book not found" }, 404, cors);
    if (book.publish_status !== "published") return json({ error: "This book isn't published yet" }, 400, cors);
    if (book.is_free) return json({ error: "This book is free — no purchase needed" }, 400, cors);
    if (!book.price_vx || book.price_vx <= 0) return json({ error: "This book isn't available for VX purchase" }, 400, cors);

    // Idempotent: a caller retrying after a network hiccup shouldn't be
    // charged twice.
    const { data: existing } = await userClient
      .from("library_purchases")
      .select("id")
      .eq("book_id", book.id)
      .eq("buyer_id", user.id)
      .in("status", ["paid", "completed"])
      .limit(1)
      .maybeSingle();
    if (existing) return json({ ok: true, purchase: existing, alreadyOwned: true }, 200, cors);

    // spend_vx runs as the calling user (auth.uid() derived internally) —
    // enforces balance and the reason whitelist itself.
    const { data: spendResult, error: spendErr } = await userClient.rpc("spend_vx", {
      _amount: book.price_vx,
      _item_type: "library_book",
      _item_id: book.id,
      _item_name: book.title,
    });
    if (spendErr) throw spendErr;
    if (!spendResult) return json({ error: "Insufficient VX balance" }, 402, cors);

    // Only reachable after spend_vx has actually succeeded — this is the
    // one place allowed to mark a purchase completed, precisely because
    // it's gated behind a real, already-verified debit.
    const { data: purchase, error: insertErr } = await serviceClient
      .from("library_purchases")
      .insert({
        buyer_id: user.id,
        book_id: book.id,
        payment_method: "vx",
        amount_vx: book.price_vx,
        status: "completed",
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    return json({ ok: true, purchase }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-purchase-book error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
