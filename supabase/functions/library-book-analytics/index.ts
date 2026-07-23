/**
 * library-book-analytics — reads library_book_daily_stats and its rollup
 * views for one book, for the author's or admin's analytics dashboard.
 * Phase 9 extends this with an optional `dimension` param reading
 * library_book_daily_dimension_stats (countries/devices/traffic sources)
 * instead — same authorization, different source table.
 *
 * Auth: user-jwt required, caller must be the book's author (via
 * is_library_book_owner) or admin.
 * Input: JSON { book_id, period?: "daily"|"weekly"|"monthly"|"yearly" (default "daily"),
 *               from?: string (ISO date), to?: string (ISO date),
 *               dimension?: "country"|"device"|"traffic_source" }
 * Returns: JSON { ok, period, rows } or, when dimension is set,
 *          { ok, dimension, rows: [{dimension_value, count}] }
 *
 * daily/weekly/yearly go through the RLS-scoped user client (the
 * underlying table/views already restrict to owner-or-admin via RLS /
 * security_invoker). monthly is a MATERIALIZED VIEW locked down to
 * service_role only (materialized views don't enforce base-table RLS for
 * anyone with SELECT — see 20260720000003_library_core_discovery_
 * analytics.sql), so this function does the owner/admin check itself
 * before using the service-role client for that one branch.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const PERIOD_TABLES: Record<string, string> = {
  daily: "library_book_daily_stats",
  weekly: "library_book_stats_weekly",
  monthly: "library_book_stats_monthly",
  yearly: "library_book_stats_yearly",
};

interface RequestBody {
  book_id: string;
  period?: keyof typeof PERIOD_TABLES;
  from?: string;
  to?: string;
  dimension?: "country" | "device" | "traffic_source";
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

  const { book_id, period = "daily", from, to } = body;
  if (!book_id) return json({ error: "book_id is required" }, 400, cors);
  const table = PERIOD_TABLES[period];
  if (!table) return json({ error: `Unknown period "${period}"` }, 400, cors);

  try {
    // Manual authorization check — required for the monthly branch (no RLS
    // on a materialized view), and doubles as a fast 403 for the other
    // branches instead of relying solely on RLS returning an empty set.
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    let isOwner = false;
    if (!roleRow) {
      const { data: book } = await userClient
        .from("library_books")
        .select("author_id, library_authors!inner(user_id)")
        .eq("id", book_id)
        .maybeSingle();
      isOwner = !!book && (book as unknown as { library_authors: { user_id: string | null } }).library_authors?.user_id === user.id;
    }

    if (!roleRow && !isOwner) {
      return json({ error: "Admin access or book ownership required" }, 403, cors);
    }

    if (body.dimension) {
      let dimQuery = userClient
        .from("library_book_daily_dimension_stats")
        .select("dimension_value, count, stat_date")
        .eq("book_id", book_id)
        .eq("dimension", body.dimension);
      if (from) dimQuery = dimQuery.gte("stat_date", from);
      if (to) dimQuery = dimQuery.lte("stat_date", to);
      const { data: dimRows, error: dimErr } = await dimQuery;
      if (dimErr) throw dimErr;

      const totals = new Map<string, number>();
      for (const row of dimRows ?? []) {
        totals.set(row.dimension_value, (totals.get(row.dimension_value) ?? 0) + row.count);
      }
      const rows = Array.from(totals, ([dimension_value, count]) => ({ dimension_value, count })).sort((a, b) => b.count - a.count);
      return json({ ok: true, dimension: body.dimension, rows }, 200, cors);
    }

    const client = period === "monthly" ? serviceClient : userClient;
    let query = client.from(table).select("*").eq("book_id", book_id);
    const dateColumn = period === "daily" ? "stat_date" : "period_start";
    if (from) query = query.gte(dateColumn, from);
    if (to) query = query.lte(dateColumn, to);
    query = query.order(dateColumn, { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    return json({ ok: true, period, rows: data ?? [] }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-book-analytics error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
