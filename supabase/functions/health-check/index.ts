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
  return { ok: true, status: "ok", detail: `${name} is configured.` };
}

/** Postgres `undefined_table` and the PostgREST schema-cache equivalent. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

async function checkTable(db: ReturnType<typeof createClient>, tableName: string): Promise<ComponentStatus> {
  try {
    // `select("*").limit(0)` asks for every column but no rows: it proves the
    // table is reachable without naming a column and without reading any data.
    //
    // Naming a column here would be wrong, not merely wasteful. Tables keyed
    // by `user_id` (credit_wallets, trial_status) have no `id` column, so
    // probing for one returns Postgres 42703 `undefined_column`, whose message
    // also contains the words "does not exist" — which used to be reported as
    // a missing table, telling admins to run migrations that had already run.
    //
    // `head: true` would be the obvious alternative and is a trap: PostgREST
    // answers a HEAD on a missing table with a 404 and an empty body, and
    // postgrest-js turns an empty 404 body into a 204 with no error at all —
    // so a genuinely missing table would report as healthy.
    const { error } = await (db as any).from(tableName).select("*").limit(0);
    if (error) {
      // Match on the error code, never on message text.
      const detail = MISSING_TABLE_CODES.has(error.code)
        ? `Table '${tableName}' does not exist. Run Supabase migrations.`
        : `Table '${tableName}' error: ${error.message}`;
      return { ok: false, status: "error", detail };
    }
    return { ok: true, status: "ok", detail: `Table '${tableName}' is accessible.` };
  } catch (e) {
    return { ok: false, status: "error", detail: `Exception checking '${tableName}': ${e}` };
  }
}

// ── Live provider probes ─────────────────────────────────────────────────────
//
// checkOpenAI() below lists models. That proves the key exists and is not
// revoked — and nothing else. A key with a zero balance lists models happily
// and fails every generation with 429 `insufficient_quota`, which is exactly
// what happened in production: this endpoint reported `openai -> ok` while all
// 23 OpenAI-backed functions were dead. A check that cannot fail when the thing
// it checks is broken is worse than no check, because it is trusted.
//
// So: generate one token, for real, and report what the API says.
//
// Admin-only, because it costs money and this endpoint is public and
// unauthenticated. Anonymous callers keep the free listing check; letting them
// trigger paid calls would turn a diagnostics URL into a way to drain the
// budget.

interface ProbeTarget {
  /** Must match the model the platform actually calls, or the probe proves nothing. */
  model: string;
  envKey: string;
  url: string;
  headers: (key: string) => Record<string, string>;
  body: (model: string) => unknown;
}

const LIVE_PROBES: Record<string, ProbeTarget> = {
  openai: {
    model: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    headers: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (model) => ({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  },
  groq: {
    model: "llama-3.1-8b-instant",
    envKey: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    headers: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (model) => ({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  },
  mistral: {
    model: "mistral-small-latest",
    envKey: "MISTRAL_API_KEY",
    url: "https://api.mistral.ai/v1/chat/completions",
    headers: (key) => ({ Authorization: `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (model) => ({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
  },
  gemini: {
    // Deliberately NOT the id in MODEL_MATRIX. That row still holds
    // `gemini-2.5-flash`, which is confirmed dead (404 "no longer available to
    // new users"), and Gemini is out of the default provider chain because of
    // it. Pointing this probe at the known-dead id would only re-report a fault
    // we have already recorded; pointing it at the candidate replacement is the
    // one useful thing it can do.
    //
    // Do not "resync" this to MODEL_MATRIX. Sync it the other way once this
    // probe reports ok — that is the signal the id is safe to route to.
    //
    // Expect `error: out of credit` until the Gemini account is funded, which
    // is a separate fault from the model id and blocks verifying either.
    model: "gemini-flash-latest",
    envKey: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    headers: (key) => ({ "x-goog-api-key": key, "Content-Type": "application/json" }),
    body: () => ({
      contents: [{ role: "user", parts: [{ text: "ping" }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  },
};

/**
 * Distinguish "out of money" from "too many requests". Both arrive as 429 and
 * they need opposite responses: one needs a payment, the other needs patience.
 */
function classifyProviderFailure(status: number, body: string): ComponentStatus | null {
  const lower = body.toLowerCase();

  if (lower.includes("insufficient_quota") || lower.includes("no credits remaining")) {
    return { ok: false, status: "error", detail: "Out of credit — the key is valid but every generation is refused. Add credit or enable billing." };
  }
  if (status === 429) {
    return { ok: false, status: "warning", detail: "Rate limited or over quota. Key works; requests are being throttled." };
  }
  if (status === 401 || status === 403) {
    return { ok: false, status: "error", detail: "Key is invalid, revoked, or lacks permission for this model." };
  }
  if (status === 404) {
    return { ok: false, status: "error", detail: "Model not available to this key. The configured model id is stale — update it." };
  }
  return null;
}

/** One real generation, capped at a single output token. */
async function probeGeneration(provider: string): Promise<ComponentStatus> {
  const target = LIVE_PROBES[provider];
  const apiKey = Deno.env.get(target.envKey);
  if (!apiKey) {
    return { ok: false, status: "missing", detail: `${target.envKey} not configured.` };
  }

  try {
    const res = await fetch(target.url.replace("{model}", target.model), {
      method: "POST",
      headers: target.headers(apiKey),
      body: JSON.stringify(target.body(target.model)),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const classified = classifyProviderFailure(res.status, body);
      if (classified) {
        return { ...classified, detail: `${provider} (${target.model}): ${classified.detail}` };
      }
      return { ok: false, status: "error", detail: `${provider} (${target.model}) returned HTTP ${res.status}.` };
    }

    return { ok: true, status: "ok", detail: `${provider} (${target.model}) generated successfully.` };
  } catch (e) {
    return { ok: false, status: "error", detail: `Cannot reach ${provider}: ${e}` };
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
    // Free listing call: proves the key exists, is not revoked, and the API is
    // reachable. It does NOT prove generation works — a key with no balance
    // lists models and then refuses every completion. That gap is covered by
    // the admin-only probe_generation() above; this check must not be read as
    // "OpenAI is working".
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
      detail: `OpenAI key valid and API reachable (generation not verified here). TTS models: ${hasTts ? "✓" : "✗"}, DALL·E: ${hasDalle ? "✓" : "✗"}`,
    };
  } catch (e) {
    return { ok: false, status: "error", detail: `Cannot reach api.openai.com: ${e}` };
  }
}

async function checkLuma(): Promise<ComponentStatus> {
  const apiKey = Deno.env.get("LUMA_API_KEY");
  if (!apiKey) {
    const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");
    return {
      // Luma is the fallback provider; video generation runs on OpenAI Sora
      // while OPENAI_API_KEY is set, so a missing Luma key is only a problem
      // once OpenAI's Videos API shuts down (announced for 2026-09-24).
      ok:     hasOpenAI,
      status: hasOpenAI ? "ok" : "warning",
      detail: hasOpenAI
        ? "LUMA_API_KEY not configured. Video generation is running on OpenAI Sora. Set LUMA_API_KEY before the OpenAI Videos API shuts down on 2026-09-24."
        : "Neither LUMA_API_KEY nor OPENAI_API_KEY is configured. Video generation will fail.",
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
        detail: "LUMA_API_KEY is invalid. Video generation cannot fall back to Luma.",
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
      detail: "ELEVENLABS_API_KEY not configured. Voice cloning is unavailable until a real provider key is added.",
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
        detail: "ELEVENLABS_API_KEY is invalid. Voice cloning is unavailable until the key is replaced.",
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

/**
 * Every third-party secret the platform depends on, and what stops working
 * without it. Presence only — a value is never read, logged or returned.
 *
 * This inventory is admin-gated: anonymous callers get exactly the response
 * they got before, because "which integrations exist" is reconnaissance we
 * have no reason to publish.
 */
const PLATFORM_SECRETS: { name: string; impact: string }[] = [
  { name: "OPENAI_API_KEY",       impact: "Nearly every AI surface: chat, OCR, speech, images, text tools, Text-to-Video (Sora), Academy, Library and Kids assistants." },
  { name: "ANTHROPIC_API_KEY",    impact: "Any assistant configured with provider 'anthropic'. Those return 500 without it; OpenAI-backed assistants are unaffected." },
  { name: "GEMINI_API_KEY",       impact: "Opt-in Gemini assistants. Kept out of automatic routing until billing and model access pass a live generation probe." },
  { name: "GROQ_API_KEY",         impact: "Low-cost text fallback for Career Center assistants when OpenAI is unavailable." },
  { name: "MISTRAL_API_KEY",      impact: "Second low-cost text fallback for Career Center assistants when OpenAI and Groq are unavailable." },
  { name: "ELEVENLABS_API_KEY",   impact: "Voice Studio voice cloning and ElevenLabs speech voices." },
  { name: "LUMA_API_KEY",         impact: "Fallback video provider. Only needed once OpenAI's Videos API shuts down on 2026-09-24." },
  { name: "REPLICATE_API_TOKEN",  impact: "Image Tools (image-tools-generate): upscale, background removal, variations." },
  { name: "STRIPE_SECRET_KEY",    impact: "Bazaar checkout, Library checkout and Career billing." },
  { name: "STRIPE_WEBHOOK_SECRET", impact: "Bazaar payment confirmation. Orders stay unconfirmed without it." },
  { name: "STRIPE_WEBHOOK_SECRET_LIBRARY", impact: "Library purchase confirmation." },
  { name: "CAREER_STRIPE_WEBHOOK_SECRET",  impact: "Career Center subscription confirmation." },
  { name: "PAYPAL_CLIENT_ID",     impact: "Library PayPal checkout." },
  { name: "PAYPAL_CLIENT_SECRET", impact: "Library PayPal checkout." },
  { name: "PAYPAL_WEBHOOK_ID",    impact: "Library PayPal payment confirmation." },
  { name: "COINBASE_COMMERCE_API_KEY",      impact: "Library crypto checkout." },
  { name: "COINBASE_COMMERCE_WEBHOOK_SECRET", impact: "Library crypto payment confirmation." },
  { name: "RESEND_API_KEY",       impact: "All outbound email: contact form, seller notifications, newsletters, VX coin review." },
  { name: "RESEND_FROM",          impact: "Sender address for outbound email." },
  { name: "LIVEKIT_API_KEY",      impact: "Live voice rooms." },
  { name: "LIVEKIT_API_SECRET",   impact: "Live voice rooms." },
  { name: "LIVEKIT_URL",          impact: "Live voice rooms." },
  // WhatsApp Cloud API. The inventory previously listed only the two names the
  // Bazaar path read, so the four the webhook depends on could be missing in
  // production without any admin surface saying so — which is exactly what had
  // happened. All of them are listed now, and WHATSAPP_ACCESS_TOKEN is gone:
  // it was a second name for WHATSAPP_TOKEN and both send paths now read the
  // canonical one.
  { name: "WHATSAPP_TOKEN",           impact: "Sending any WhatsApp message: assistant replies and Bazaar seller notifications." },
  { name: "WHATSAPP_PHONE_NUMBER_ID", impact: "Sending any WhatsApp message. The Cloud API phone number id, not the phone number." },
  { name: "WHATSAPP_APP_SECRET",      impact: "Verifying X-Hub-Signature-256. Without it the webhook refuses every delivery with 503." },
  { name: "WHATSAPP_VERIFY_TOKEN",    impact: "Meta's one-time callback handshake. Without it the callback URL cannot be registered." },
  { name: "META_APP_ID",              impact: "Facebook and Instagram OAuth. Connections cannot be started without it." },
  { name: "META_APP_SECRET",          impact: "Facebook and Instagram OAuth token exchange." },
  { name: "CRON_SECRET",          impact: "Scheduled jobs: news generation, trial billing, library background jobs." },
  { name: "LIBRARY_CERTIFICATE_SIGNING_SECRET", impact: "Signing Library completion certificates." },
  { name: "KIDS_CERTIFICATE_SIGNING_SECRET",    impact: "Signing VisionKids certificates." },
  { name: "SITE_URL",             impact: "Checkout return URLs. Redirects break without it." },
  { name: "ALLOWED_ORIGINS",      impact: "CORS allow-list for the LiveKit token endpoint." },
];

/** True only for a caller presenting a valid JWT whose user has the admin role. */
async function callerIsAdmin(
  req: Request,
  supabaseUrl: string,
  anonKey: string,
  serviceKey: string,
): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !supabaseUrl || !anonKey || !serviceKey) return false;

  // An anon-key bearer token is not a user session — ignore it.
  if (authHeader === `Bearer ${anonKey}`) return false;

  try {
    const asUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await asUser.auth.getUser();
    if (error || !user) return false;

    const svc = createClient(supabaseUrl, serviceKey);
    const { data, error: roleErr } = await (svc as any).rpc("has_role", {
      _user_id: user.id,
      _role:    "admin",
    });
    return !roleErr && data === true;
  } catch {
    return false;
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

  // ── Secret inventory (admins only) ────────────────────────────────────────────
  //
  // Answers "does every service that needs an API key actually have one?" without
  // ever exposing a value. Anonymous callers get the same response as before.

  const isAdmin = await callerIsAdmin(req, supabaseUrl ?? "", anonKey ?? "", serviceKey ?? "");
  if (isAdmin) {
    for (const secret of PLATFORM_SECRETS) {
      const configured = !!Deno.env.get(secret.name);
      results[`secret_${secret.name}`] = {
        ok:     configured,
        status: configured ? "ok" : "missing",
        detail: configured
          ? `${secret.name} is configured.`
          : `${secret.name} is NOT configured — ${secret.impact}`,
      };
    }

    // Live generation probes. Admin-only and one output token each, so the
    // whole block costs a fraction of a cent and cannot be triggered by an
    // anonymous caller. Run together: four sequential round trips would add
    // seconds to a diagnostics request for no reason.
    const probed = Object.keys(LIVE_PROBES);
    const probeResults = await Promise.all(probed.map((p) => probeGeneration(p)));
    probed.forEach((provider, i) => {
      results[`provider_live_${provider}`] = probeResults[i];
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  const allOk    = Object.values(results).every((r) => r.ok);
  const errors   = Object.entries(results).filter(([, r]) => r.status === "error").map(([k]) => k);
  const warnings = Object.entries(results).filter(([, r]) => r.status === "warning").map(([k]) => k);
  const missing  = Object.entries(results).filter(([, r]) => r.status === "missing").map(([k]) => k);

  return json({
    ok:        allOk,
    timestamp: new Date().toISOString(),
    // Tells the caller whether the secret inventory above was included, so an
    // absent secret_* section reads as "not an admin" rather than "all fine".
    secret_audit_included: isAdmin,
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
