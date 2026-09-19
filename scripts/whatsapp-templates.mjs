#!/usr/bin/env node
// Submits the WhatsApp message templates Visionex needs, and reports their
// review status.
//
//   node --experimental-strip-types scripts/whatsapp-templates.mjs --check
//   node --experimental-strip-types scripts/whatsapp-templates.mjs --create
//
// Run from .github/workflows/whatsapp-templates.yml, where WHATSAPP_TOKEN stays
// in the secret store. Prints template names, languages and statuses — never
// the token, and the business account id is masked.

import { readFileSync } from "node:fs";
import { PLAN_REMINDER_TEMPLATE } from "../supabase/functions/_shared/whatsappPlanReminder.ts";
import { OWNER_CONTENT_TEMPLATE } from "../supabase/functions/_shared/ownerContent.ts";

const create = process.argv.includes("--create");
const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const inActions = process.env.GITHUB_ACTIONS === "true";

function fail(message) {
  console.error(inActions ? `::error::${message}` : message);
  process.exit(1);
}

if (!token || !phoneNumberId) fail("WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.");

// One Graph version for the whole repository: the one the Edge Functions use.
const meta = readFileSync(new URL("../supabase/functions/_shared/meta.ts", import.meta.url), "utf8");
const version = /(v\d+\.\d+)/.exec(meta.slice(meta.indexOf("GRAPH_VERSION")))?.[1] ?? "v21.0";
const graph = `https://graph.facebook.com/${version}`;

async function call(path, init = {}) {
  const res = await fetch(`${graph}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Meta's error names the problem; the request, which carries the token in
    // one of these paths, is never printed.
    const error = body?.error ?? {};
    throw new Error(`Graph ${res.status} (${error.code ?? "?"}/${error.error_subcode ?? "-"}): ${error.message ?? "request failed"}`);
  }
  return body;
}

/** The id the webhook stored from a signed delivery, or null. */
async function storedBusinessAccount() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/site_settings?select=value&key=eq.whatsapp_business_account_id`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const value = Array.isArray(rows) ? rows[0]?.value : null;
    return typeof value === "string" && /^\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Whether this account lists our sending number. */
async function ownsNumber(id) {
  try {
    const numbers = await call(`${id}/phone_numbers?fields=id&limit=100`);
    return (numbers.data ?? []).some((number) => number.id === phoneNumberId);
  } catch {
    return false;
  }
}

/**
 * The WhatsApp Business Account that owns the sending number.
 *
 * Three ways, cheapest first, and each one says why it did not work — names
 * and counts only, never an id or the token:
 *  1. an id given explicitly (the workflow input, or a secret);
 *  2. the token's own granular scopes, which name the accounts it may manage
 *     when access was granted per account;
 *  3. the businesses the token can see, and the accounts each one owns or
 *     manages for a client — the shape a System User token granted access to a
 *     whole business has, where (2) comes back without target ids.
 */
async function businessAccountId() {
  const given = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "").trim();
  if (given) {
    if (!/^\d+$/.test(given)) throw new Error("The WhatsApp Business Account ID must be digits only.");
    if (inActions) console.log(`::add-mask::${given}`);
    if (await ownsNumber(given)) return given;
    throw new Error("The WhatsApp Business Account ID given does not own WHATSAPP_PHONE_NUMBER_ID, or this token cannot read it.");
  }

  const tried = [];

  // Remembered by the webhook from the envelope of a signed delivery.
  const stored = await storedBusinessAccount();
  if (stored) {
    if (inActions) console.log(`::add-mask::${stored}`);
    if (await ownsNumber(stored)) return stored;
    tried.push("the account the webhook remembered does not own the number");
  } else {
    tried.push("the webhook has not remembered an account yet — it does on the next message Meta delivers");
  }

  try {
    const debug = await call(`debug_token?input_token=${encodeURIComponent(token)}`);
    const data = debug?.data ?? {};
    const scopes = data.granular_scopes ?? [];
    console.log(
      `token: type=${data.type ?? "?"} valid=${data.is_valid ?? "?"} ` +
      `scopes=[${(data.scopes ?? []).join(", ")}] ` +
      `granular=[${scopes.map((scope) => `${scope.scope}:${(scope.target_ids ?? []).length}`).join(", ")}]`,
    );
    const candidates = [...new Set(
      scopes
        .filter((scope) => scope.scope === "whatsapp_business_management" || scope.scope === "whatsapp_business_messaging")
        .flatMap((scope) => scope.target_ids ?? []),
    )];
    for (const id of candidates) if (await ownsNumber(id)) return id;
    tried.push(`granular scopes: ${candidates.length} account(s), none owns the number`);
  } catch (error) {
    tried.push(`debug_token: ${error.message}`);
  }

  try {
    const businesses = await call("me/businesses?fields=id&limit=50");
    const ids = (businesses.data ?? []).map((business) => business.id);
    let accounts = 0;
    for (const business of ids) {
      for (const edge of ["owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"]) {
        try {
          const listed = await call(`${business}/${edge}?fields=id&limit=100`);
          for (const account of listed.data ?? []) {
            accounts++;
            if (await ownsNumber(account.id)) return account.id;
          }
        } catch (error) {
          tried.push(`${edge}: ${error.message}`);
        }
      }
    }
    tried.push(`businesses: ${ids.length} business(es), ${accounts} account(s), none owns the number`);
  } catch (error) {
    tried.push(`me/businesses: ${error.message}`);
  }

  for (const line of tried) console.log(`  tried — ${line}`);
  throw new Error(
    "Could not find the WhatsApp Business Account that owns the phone number. " +
    "Run the workflow again with its WhatsApp Business Account ID (WhatsApp Manager → Account tools → " +
    "or Business settings → Accounts → WhatsApp accounts).",
  );
}

try {
  const waba = await businessAccountId();
  if (inActions) console.log(`::add-mask::${waba}`);

  let problems = 0;
  for (const template of [PLAN_REMINDER_TEMPLATE, OWNER_CONTENT_TEMPLATE]) {
    const listed = await call(
      `${waba}/message_templates?name=${encodeURIComponent(template.name)}&fields=name,language,status,category,rejected_reason&limit=50`,
    );
    const byLanguage = new Map(
      (listed.data ?? []).filter((row) => row.name === template.name).map((row) => [row.language, row]),
    );

    for (const [language, translation] of Object.entries(template.translations)) {
      const current = byLanguage.get(language);
      if (current) {
        const reason = current.rejected_reason && current.rejected_reason !== "NONE" ? `, ${current.rejected_reason}` : "";
        console.log(`${template.name} [${language}]: ${current.status} (${current.category}${reason})`);
        if (current.status === "REJECTED" || current.status === "DISABLED") problems++;
        continue;
      }
      if (!create) {
        console.log(`${template.name} [${language}]: not submitted — run with mode=create`);
        problems++;
        continue;
      }
      const made = await call(`${waba}/message_templates`, {
        method: "POST",
        body: JSON.stringify({
          name: template.name,
          language,
          category: template.category,
          components: [{ type: "BODY", text: translation.body, example: { body_text: [translation.example] } }],
        }),
      });
      console.log(`${template.name} [${language}]: submitted — ${made.status ?? "PENDING"} (${made.category ?? template.category})`);
      if (made.status === "REJECTED") problems++;
    }
  }
  process.exit(problems > 0 ? 1 : 0);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // The scheduled run keeps trying until the account is known. Until then it
  // is waiting, not failing, and a red run every six hours would be noise.
  if (process.argv.includes("--pending-ok") && message.startsWith("Could not find")) {
    console.log(inActions ? `::notice::${message}` : message);
    process.exit(0);
  }
  fail(message);
}
