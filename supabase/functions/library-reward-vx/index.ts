/**
 * library-reward-vx — thin wrapper around the award_library_xp() RPC
 * (20260720000002_library_core_commerce_gamification.sql) for reading
 * milestone events. The RPC itself enforces the real per-reason amount cap
 * (it's GRANTed to `authenticated` and callable directly, so the cap has to
 * live in the database, not just here) — this function's job is to map a
 * friendly `event` name to the exact reason string the RPC's whitelist
 * expects, and to keep detail formatting (book title, streak length, etc.)
 * out of client hands.
 *
 * Auth: user-jwt required
 * Input: JSON { event: "book_completed"|"review_written"|"reading_streak"|
 *               "challenge_completed"|"daily_reading_goal",
 *               amount: number, detail?: string }
 * Returns: JSON { ok }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const EVENT_REASON_PREFIX: Record<string, string> = {
  book_completed: "Book completed",
  review_written: "Review written",
  reading_streak: "Reading streak",
  challenge_completed: "Challenge completed",
  daily_reading_goal: "Daily reading goal",
};

interface RequestBody {
  event: keyof typeof EVENT_REASON_PREFIX;
  amount: number;
  detail?: string;
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

  const { event, amount, detail } = body;
  const prefix = EVENT_REASON_PREFIX[event];
  if (!prefix) return json({ error: `Unknown event "${event}"` }, 400, cors);
  if (typeof amount !== "number" || amount <= 0) return json({ error: "amount must be a positive number" }, 400, cors);

  const reason = detail ? `${prefix}: ${detail}` : `${prefix}:`;

  try {
    const { error } = await userClient.rpc("award_library_xp", { _amount: amount, _reason: reason });
    if (error) throw error;
    return json({ ok: true }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-reward-vx error:", msg);
    // award_library_xp raises a specific "Amount exceeds maximum" exception
    // for over-cap requests — surface that as 400, not 500.
    const status = msg.includes("Amount exceeds maximum") || msg.includes("Invalid reason") ? 400 : 500;
    return json({ error: msg }, status, cors);
  }
});
