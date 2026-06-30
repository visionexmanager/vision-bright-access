/**
 * health-check — AI Media Studio system diagnostics
 *
 * Tests every component of the generation pipeline and returns
 * detailed status for each. No auth required (read-only diagnostics).
 *
 * Returns:
 *   { ok, timestamp, components: { [name]: { ok, status, detail } } }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface ComponentStatus {
  ok:     boolean;
  status: "ok" | "warning" | "error" | "missing";
  detail: string;
}

async function checkEnvVar(name: string): Promise<ComponentStatus> {
  const val = Deno.env.get(name);
  if (!val) {
    return {
      ok:     false,
      status: "missing",
      detail: `Environment variable ${name} is not set in Supabase Edge Function secrets.`,
    };
  }
  return { ok: true, status: "ok", detail: `${name} is configured (${val.slice(0, 6)}…)` };
}

async function checkTable(db: ReturnType<typeof createClient>, tableName: string): Promise<ComponentStatus> {
  try {
    const { error } = await (db as any).from(tableName).select("id").limit(1);
    if (error) {
      const detail = error.message.includes("does not exist")
        ? `Table '${tableName}' does not exist. Run Supabase migrations.`
        : `Table '${tableName}' error: ${error.message}`;
      return { ok: false, status: "error", detail };
    }
    return { ok: true, status: "ok", detail: `Table '${tableName}' is accessible.` };
  } catch (e) {
    return { ok: false, status: "error", detail: `Exception checking '${tableName}': ${e}` };
  }
}

async function checkOpenAI(): Promise<ComponentStatus> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      ok:     false,
      status: "missing",
      detail: "OPENAI_API_KEY not configured. Speech generation and image generation will fail.",
    };
  }
  try {
    // Test with a minimal models list call — no generation, no cost
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      return {
        ok:     false,
        status: "error",
        detail: "OPENAI_API_KEY is invalid or revoked. Update the secret in Supabase dashboard.",
      };
    }
    if (res.status === 429) {
      return {
        ok:     false,
        status: "warning",
        detail: "OpenAI rate limited. Key is valid but requests are being throttled.",
      };
    }
    if (!res.ok) {
      return {
        ok:     false,
        status: "error",
        detail: `OpenAI returned HTTP ${res.status}. Check API status at status.openai.com.`,
      };
    }
    const data = await res.json();
    const hasTts  = (data.data ?? []).some((m: Record<string, string>) => m.id?.startsWith("tts"));
    const hasDalle = (data.data ?? []).some((m: Record<string, string>) => m.id?.startsWith("dall-e"));
    return {
      ok:     true,
      status: "ok",
      detail: `OpenAI connected. TTS models: ${hasTts ? "✓" : "✗"}, DALL·E: ${hasDalle ? "✓" : "✗"}`,
    };
  } catch (e) {
    return { ok: false, status: "error", detail: `Cannot reach api.openai.com: ${e}` };
  }
}

async function checkLuma(): Promise<ComponentStatus> {
  const apiKey = Deno.env.get("LUMA_API_KEY");
  if (!apiKey) {
    return {
      ok:     false,
      status: "warning",
      detail: "LUMA_API_KEY not configured. Video generation will use the mock provider (demo videos only).",
    };
  }
  try {
    const res = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok:     false,
        status: "error",
        detail: "LUMA_API_KEY is invalid. Video generation will fall back to mock provider.",
      };
    }
    if (!res.ok) {
      return {
        ok:     false,
        status: "warning",
        detail: `Luma returned HTTP ${res.status}. Key may be valid but API is degraded.`,
      };
    }
    return { ok: true, status: "ok", detail: "Luma Dream Machine API connected and key is valid." };
  } catch (e) {
    return { ok: false, status: "error", detail: `Cannot reach api.lumalabs.ai: ${e}` };
  }
}

async function checkElevenLabs(): Promise<ComponentStatus> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return {
      ok:     false,
      status: "warning",
      detail: "ELEVENLABS_API_KEY not configured. Voice cloning will use the mock provider.",
    };
  }
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      headers: { "xi-api-key": apiKey },
    });
    if (res.status === 401) {
      return {
        ok:     false,
        status: "error",
        detail: "ELEVENLABS_API_KEY is invalid. Voice cloning will fall back to mock provider.",
      };
    }
    if (!res.ok) {
      return {
        ok:     false,
        status: "warning",
        detail: `ElevenLabs returned HTTP ${res.status}.`,
      };
    }
    const data = await res.json();
    const tier = data?.subscription?.tier ?? "unknown";
    return {
      ok:     true,
      status: "ok",
      detail: `ElevenLabs connected. Subscription tier: ${tier}.`,
    };
  } catch (e) {
    return { ok: false, status: "error", detail: `Cannot reach api.elevenlabs.io: ${e}` };
  }
}

async function checkStorage(db: ReturnType<typeof createClient>, bucketId: string): Promise<ComponentStatus> {
  try {
    const { data, error } = await (db as any).storage.from(bucketId).list("", { limit: 1 });
    if (error) {
      return {
        ok:     false,
        status: "error",
        detail: `Storage bucket '${bucketId}': ${error.message}. Run migrations to create buckets.`,
      };
    }
    return { ok: true, status: "ok", detail: `Storage bucket '${bucketId}' is accessible.` };
  } catch (e) {
    return { ok: false, status: "error", detail: `Storage check failed: ${e}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY");

  const results: Record<string, ComponentStatus> = {};

  // ── Supabase environment ──────────────────────────────────────────────────────

  results.supabase_url = {
    ok:     !!supabaseUrl,
    status: supabaseUrl ? "ok" : "missing",
    detail: supabaseUrl ? `SUPABASE_URL configured.` : "SUPABASE_URL is not set in edge function environment.",
  };

  results.supabase_service_key = {
    ok:     !!serviceKey,
    status: serviceKey ? "ok" : "missing",
    detail: serviceKey ? "SUPABASE_SERVICE_ROLE_KEY configured." : "SUPABASE_SERVICE_ROLE_KEY is not set.",
  };

  results.supabase_anon_key = {
    ok:     !!anonKey,
    status: anonKey ? "ok" : "missing",
    detail: anonKey ? "SUPABASE_ANON_KEY configured." : "SUPABASE_ANON_KEY is not set.",
  };

  // ── AI Provider API keys ──────────────────────────────────────────────────────

  results.openai = await checkOpenAI();
  results.luma   = await checkLuma();
  results.elevenlabs = await checkElevenLabs();

  // ── Database tables ───────────────────────────────────────────────────────────

  if (supabaseUrl && serviceKey) {
    const db = createClient(supabaseUrl, serviceKey) as ReturnType<typeof createClient>;

    const tables = [
      "ams_voices",
      "ams_speech_jobs",
      "ams_assets",
      "ams_projects",
      "vx_video_jobs",
      "vs_voice_profiles",
      "vs_training_jobs",
      "credit_wallets",
      "trial_status",
      "billing_plans",
      "ph_providers",
    ];

    for (const table of tables) {
      results[`db_${table}`] = await checkTable(db, table);
    }

    // ── Storage buckets ─────────────────────────────────────────────────────────
    results.storage_speech  = await checkStorage(db, "speech-outputs");
    results.storage_video   = await checkStorage(db, "video-outputs");
    results.storage_voice   = await checkStorage(db, "voice-datasets");
    results.storage_images  = await checkStorage(db, "image-outputs");
  } else {
    results.database = {
      ok:     false,
      status: "error",
      detail: "Cannot check database: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
    };
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  const allOk    = Object.values(results).every((r) => r.ok);
  const errors   = Object.entries(results).filter(([, r]) => r.status === "error").map(([k]) => k);
  const warnings = Object.entries(results).filter(([, r]) => r.status === "warning").map(([k]) => k);
  const missing  = Object.entries(results).filter(([, r]) => r.status === "missing").map(([k]) => k);

  return json({
    ok:        allOk,
    timestamp: new Date().toISOString(),
    summary: {
      total:    Object.keys(results).length,
      passing:  Object.values(results).filter((r) => r.ok).length,
      errors:   errors.length,
      warnings: warnings.length,
      missing:  missing.length,
      error_keys:   errors,
      warning_keys: warnings,
      missing_keys: missing,
    },
    components: results,
  });
});
