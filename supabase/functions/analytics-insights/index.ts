import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch analytics data using service role
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [eventsRes, productsRes, contentRes] = await Promise.all([
      serviceClient.from("page_events").select("*").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(1000),
      serviceClient.from("products").select("id, name, category, store_type").limit(500),
      serviceClient.from("content_items").select("id, title, category, type").limit(500),
    ]);

    const events = eventsRes.data || [];
    const products = productsRes.data || [];
    const content = contentRes.data || [];

    // Compute stats
    const pageViews: Record<string, number> = {};
    const eventTypes: Record<string, number> = {};
    const uniqueSessions = new Set<string>();
    
    for (const e of events) {
      pageViews[e.page_path] = (pageViews[e.page_path] || 0) + 1;
      eventTypes[e.event_type] = (eventTypes[e.event_type] || 0) + 1;
      if (e.session_id) uniqueSessions.add(e.session_id);
    }

    const topPages = Object.entries(pageViews)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    const stats = {
      totalPageViews: events.length,
      uniqueSessions: uniqueSessions.size,
      topPages,
      eventBreakdown: eventTypes,
      totalProducts: products.length,
      totalContent: content.length,
    };

    // Generate AI insights
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ stats, insights: "AI insights unavailable — OpenAI API key not configured." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Analyze this website analytics data for an accessibility-focused platform called Visionex and provide 5-7 actionable insights.

Data (last 30 days):
- Total page views: ${stats.totalPageViews}
- Unique sessions: ${stats.uniqueSessions}
- Top pages: ${JSON.stringify(topPages)}
- Event types: ${JSON.stringify(eventTypes)}
- Products: ${products.length} (categories: ${[...new Set(products.map(p => p.category))].join(", ")})
- Content items: ${content.length}

Focus on:
1. Most visited pages and what they indicate about user interests
2. Pages where users might be leaving (low engagement paths)
3. Products/categories getting most attention
4. Accessibility improvement suggestions
5. Popular educational topics
6. Frequently viewed product categories

Keep insights concise and actionable. Use bullet points.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    let insights = "Unable to generate insights at this time.";
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      insights = aiData.choices?.[0]?.message?.content || insights;
    }

    return new Response(JSON.stringify({ stats, insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analytics-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
