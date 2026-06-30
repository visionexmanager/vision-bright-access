/**
 * trial-billing — Supabase Edge Function
 *
 * Runs daily (via cron or external scheduler).
 * 1. Sends 3-day warning email + in-app notification to users whose trial
 *    expires in 3 days and haven't been warned yet.
 * 2. After trial expires, deducts monthly bazaar shop rent from VX balance.
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

  // ── 1. 3-day warning ──────────────────────────────────────────────────
  const warnWindowStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 12 * 60 * 60 * 1000);
  const warnWindowEnd   = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);

  const { data: warnUsers, error: warnErr } = await supabase
    .from("profiles")
    .select("user_id, display_name, trial_expires_at")
    .gte("trial_expires_at", warnWindowStart.toISOString())
    .lte("trial_expires_at", warnWindowEnd.toISOString())
    .is("trial_billing_warned_at", null);

  if (warnErr) results.errors.push(`warn-query: ${warnErr.message}`);

  for (const profile of warnUsers ?? []) {
    try {
      const expiresDate = new Date(profile.trial_expires_at).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      // In-app notification
      await supabase.rpc("system_insert_notification", {
        _user_id: profile.user_id,
        _title:   "⏳ Your free trial ends in 3 days",
        _body:    `Your 30-day free trial expires on ${expiresDate}. Collect VX Coins now to continue enjoying all platform features. Bazaar shop rent will be deducted from your balance.`,
        _type:    "warning",
      });

      // Email (best-effort)
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
      if (authUser?.user?.email) {
        await sendEmail(
          authUser.user.email,
          "Your Visionex free trial ends in 3 days",
          `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#f59e0b;">⏳ Free Trial Ending Soon</h2>
<p>Hi ${profile.display_name ?? "there"},</p>
<p>Your 30-day Visionex free trial expires on <strong>${expiresDate}</strong>.</p>
<ul>
  <li>All premium features will remain accessible after your trial — they require VX Coins.</li>
  <li>Your <strong>Bazaar shop monthly rent</strong> will be deducted from your VX balance on expiry.</li>
  <li>You can still earn VX Coins through games, quizzes, and daily logins.</li>
</ul>
<p>Visit <a href="https://visionex.app/dashboard">your dashboard</a> to check your balance.</p>
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
            _body:    `Your free trial ended and your VX balance was insufficient to cover the ${shop.tier} monthly rent of ${rent.toLocaleString()} VX. Top up your VX to reactivate the shop.`,
            _type:    "error",
          });
        }
      }

      // General expiry notification
      const hasShops = (shops ?? []).length > 0;
      await supabase.rpc("system_insert_notification", {
        _user_id: profile.user_id,
        _title:   "🎉 Free trial ended — welcome to Visionex!",
        _body:    hasShops
          ? `Your 30-day free trial has ended. Bazaar shop billing has been processed. Keep earning VX Coins through games and activities to enjoy all features.`
          : `Your 30-day free trial has ended. Keep earning VX Coins to access premium features!`,
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
          "Your Visionex free trial has ended",
          `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#10b981;">🎉 Trial Complete — You're a Full Member!</h2>
<p>Hi ${profile.display_name ?? "there"},</p>
<p>Your 30-day free trial on Visionex has ended. You can continue earning VX Coins through games, quizzes, and daily logins.</p>
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
