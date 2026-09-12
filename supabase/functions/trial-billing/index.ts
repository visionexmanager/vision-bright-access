/**
 * trial-billing — Supabase Edge Function
 *
 * Runs daily (via cron or external scheduler).
 * 1. Sends a one-day warning email + in-app notification to users whose free
 *    week ends within 24 hours and who haven't been warned yet. A day is the
 *    notice somebody can act on: long enough to choose a plan, close enough
 *    that it still reads as news rather than as marketing.
 * 2. After the week expires, deducts monthly bazaar shop rent from VX balance.
 *    If insufficient VX → suspends the shop.
 *    Sends expiry email + in-app notification.
 *
 * Security: protected by CRON_SECRET env variable checked in Authorization header.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const TIER_RENT: Record<string, number> = {
  kiosk:    1_000,
  boutique: 3_000,
  store:    8_000,
  flagship: 20_000,
};

const PRICING_URL  = "https://visionex.app/pricing";

/** The three tiers, in one line, for a notification that has no room for more. */
const TIER_SUMMARY = "Bronze $5, Silver $7 or Gold $10 a month";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const BILLING_FROM   = "Visionex Billing <billing@visionex.app>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: BILLING_FROM, to: [to], subject, html, reply_to: "hello@visionex.app" }),
  });
}

Deno.serve(async (req) => {
  // ── Security: only accept requests with the correct cron secret ──
  const secret = Deno.env.get("CRON_SECRET");
  if (secret) {
    const auth = req.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = { warned: 0, billed: 0, suspended: 0, errors: [] as string[] };

  // ── 1. One-day warning ───────────────────────────────────────────────
  //
  // Who to warn is a question about a column, so the database answers it:
  // `trial_ending_soon` applies the window and the "not already warned" rule
  // in one place, instead of this function assembling a range query that has
  // to agree with the column's meaning.
  const { data: warnUsers, error: warnErr } = await supabase
    .rpc("trial_ending_soon", { _hours: 24 });

  if (warnErr) results.errors.push(`warn-query: ${warnErr.message}`);

  for (const profile of warnUsers ?? []) {
    try {
      const expiresDate = new Date(profile.trial_expires_at).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      // In-app notification
      await supabase.rpc("system_insert_notification", {
        _user_id: profile.user_id,
        _title:   "⏳ Your free week ends tomorrow",
        _body:    `Your free week of Visionex ends on ${expiresDate}. To keep every section open, choose a plan: ${TIER_SUMMARY}. Without one you keep the news, the community and the assistive-product catalogue.`,
        _type:    "warning",
      });

      // Email (best-effort)
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
      if (authUser?.user?.email) {
        await sendEmail(
          authUser.user.email,
          "Your Visionex free week ends tomorrow",
          `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#f59e0b;">⏳ Your free week ends tomorrow</h2>
<p>Hi ${profile.display_name ?? "there"},</p>
<p>Your free week of Visionex ends on <strong>${expiresDate}</strong>. Until then every section is open, on the site and on WhatsApp.</p>
<h3>Choose a plan to keep them open</h3>
<ul>
  <li><strong>Bronze — $5/month:</strong> the Visionex assistant, Academy, Library, Arcade and VXBazaar.</li>
  <li><strong>Silver — $7/month:</strong> everything in Bronze, plus VisionKids, Career Hub, TV, Radio, messages and simulations.</li>
  <li><strong>Gold — $10/month:</strong> everything in Silver, plus the AI Media Studio, Library Studio, professional tools and the Finance Hub — with no daily limit on the assistant.</li>
</ul>
<p>Without a plan your account stays open: the news, the community and the assistive-product catalogue never need one, and the assistant keeps a small free daily allowance on WhatsApp.</p>
<p><a href="${PRICING_URL}" style="display:inline-block;padding:10px 18px;background:#10b981;color:#fff;border-radius:8px;text-decoration:none;">See the plans</a></p>
<p style="color:#6b7280;font-size:0.85em;">Visionex · <a href="https://visionex.app">visionex.app</a></p>
</body></html>`
        );
      }

      // Mark warned
      await supabase
        .from("profiles")
        .update({ trial_billing_warned_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);

      results.warned++;
    } catch (e: any) {
      results.errors.push(`warn-${profile.user_id}: ${e.message}`);
    }
  }

  // ── 2. Post-expiry billing ────────────────────────────────────────────
  const billingWindowStart = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const billingWindowEnd   = new Date(); // now

  const { data: expiredUsers, error: expiredErr } = await supabase
    .from("profiles")
    .select("user_id, display_name, trial_expires_at")
    .gte("trial_expires_at", billingWindowStart.toISOString())
    .lte("trial_expires_at", billingWindowEnd.toISOString())
    .is("trial_billing_processed_at", null);

  if (expiredErr) results.errors.push(`expired-query: ${expiredErr.message}`);

  for (const profile of expiredUsers ?? []) {
    try {
      // Get user's active bazaar shops
      const { data: shops } = await supabase
        .from("bazaar_shops")
        .select("id, tier, name, is_active")
        .eq("owner_id", profile.user_id)
        .eq("is_active", true);

      const shopSummaries: string[] = [];

      for (const shop of shops ?? []) {
        const rent = TIER_RENT[shop.tier] ?? 1_000;
        const { data: deducted } = await supabase.rpc("system_deduct_vx", {
          _user_id: profile.user_id,
          _amount:  rent,
          _reason:  `Trial billing: ${shop.name} (${shop.tier}) monthly rent`,
        });

        if (deducted) {
          shopSummaries.push(`✅ ${shop.name} (${shop.tier}): ${rent.toLocaleString()} VX deducted`);
          results.billed++;
          // Update last_rent_paid
          await supabase
            .from("bazaar_shops")
            .update({ last_rent_paid: new Date().toISOString() })
            .eq("id", shop.id);
        } else {
          // Insufficient VX — suspend shop
          await supabase
            .from("bazaar_shops")
            .update({ is_active: false })
            .eq("id", shop.id);
          shopSummaries.push(`⚠️ ${shop.name} (${shop.tier}): suspended (insufficient VX)`);
          results.suspended++;
          // Notify about suspension
          await supabase.rpc("system_insert_notification", {
            _user_id: profile.user_id,
            _title:   `🔴 ${shop.name} shop suspended`,
            _body:    `Your free week ended and your VX balance was insufficient to cover the ${shop.tier} monthly rent of ${rent.toLocaleString()} VX. Top up your VX to reactivate the shop.`,
            _type:    "error",
          });
        }
      }

      // General expiry notification
      const hasShops = (shops ?? []).length > 0;
      await supabase.rpc("system_insert_notification", {
        _user_id: profile.user_id,
        _title:   "Your free week has ended",
        _body:    hasShops
          ? `Your free week has ended and Bazaar shop billing has been processed. Choose a plan — ${TIER_SUMMARY} — to reopen every section. The news, the community and assistive products stay open either way.`
          : `Your free week has ended. Choose a plan — ${TIER_SUMMARY} — to reopen every section. The news, the community and assistive products stay open either way.`,
        _type:    "info",
      });

      // Email
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
      if (authUser?.user?.email) {
        const shopRows = shopSummaries.length > 0
          ? `<h3>Bazaar Shop Billing</h3><ul>${shopSummaries.map(s => `<li>${s}</li>`).join("")}</ul>`
          : "";
        await sendEmail(
          authUser.user.email,
          "Your Visionex free week has ended",
          `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#10b981;">Your free week has ended</h2>
<p>Hi ${profile.display_name ?? "there"},</p>
<p>Your free week on Visionex has ended. The news, the community and the assistive-product catalogue stay open, and the assistant keeps a small free daily allowance on WhatsApp.</p>
<p>To reopen every section, choose <strong>Bronze $5</strong>, <strong>Silver $7</strong> or <strong>Gold $10</strong> a month — <a href="${PRICING_URL}">see what each one opens</a>.</p>
${shopRows}
<p>Visit <a href="https://visionex.app/dashboard">your dashboard</a> to manage your account.</p>
<p style="color:#6b7280;font-size:0.85em;">Questions? Contact us at <a href="mailto:hello@visionex.app">hello@visionex.app</a></p>
<p style="color:#6b7280;font-size:0.85em;">Visionex · <a href="https://visionex.app">visionex.app</a></p>
</body></html>`
        );
      }

      // Mark processed
      await supabase
        .from("profiles")
        .update({ trial_billing_processed_at: new Date().toISOString() })
        .eq("user_id", profile.user_id);

    } catch (e: any) {
      results.errors.push(`bill-${profile.user_id}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
