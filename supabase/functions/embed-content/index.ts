import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createEmbedding } from "../_shared/aiProvider.ts";

// Which tables get embedded and how their searchable text is built.
const SOURCES: Record<string, { columns: string; toText: (r: Record<string, unknown>) => string }> = {
  products: {
    columns: "id, name, description, category, store_type",
    toText: (r) => [r.name, r.category, r.store_type, r.description].filter(Boolean).join(". "),
  },
  content_items: {
    columns: "id, title, description, category, type, level",
    toText: (r) => [r.title, r.category, r.type, r.level, r.description].filter(Boolean).join(". "),
  },
};

const BATCH = 50;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Admin only ─────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { source_table } = await req.json().catch(() => ({}));
    const tables = source_table ? [source_table] : Object.keys(SOURCES);
    for (const t of tables) {
      if (!SOURCES[t]) {
        return new Response(JSON.stringify({ error: `Unknown source_table: ${t}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const summary: Record<string, number> = {};

    for (const table of tables) {
      const cfg = SOURCES[table];
      const { data: rows, error } = await service.from(table).select(cfg.columns).limit(2000);
      if (error) throw error;
      if (!rows || rows.length === 0) { summary[table] = 0; continue; }

      let embedded = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH) as Array<Record<string, unknown>>;
        const texts = chunk.map((r) => cfg.toText(r).slice(0, 6000));
        const vectors = await createEmbedding(texts);

        const upserts = chunk.map((r, j) => ({
          source_table: table,
          source_id: r.id,
          content: texts[j],
          embedding: vectors[j],
          updated_at: new Date().toISOString(),
        }));
        const { error: upErr } = await service
          .from("ai_embeddings")
          .upsert(upserts, { onConflict: "source_table,source_id" });
        if (upErr) throw upErr;
        embedded += upserts.length;
      }
      summary[table] = embedded;
    }

    return new Response(JSON.stringify({ ok: true, embedded: summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("embed-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
