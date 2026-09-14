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

/** The WhatsApp Business Account that owns the sending number. */
async function businessAccountId() {
  if (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) return process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  // A token can describe itself: its granular scopes name the accounts it may
  // manage, and the one that lists our phone number is ours.
  const debug = await call(`debug_token?input_token=${encodeURIComponent(token)}`);
  const scopes = debug?.data?.granular_scopes ?? [];
  const candidates = [...new Set(
    scopes
      .filter((scope) => scope.scope === "whatsapp_business_management" || scope.scope === "whatsapp_business_messaging")
      .flatMap((scope) => scope.target_ids ?? []),
  )];

  for (const id of candidates) {
    try {
      const numbers = await call(`${id}/phone_numbers?fields=id&limit=100`);
      if ((numbers.data ?? []).some((number) => number.id === phoneNumberId)) return id;
    } catch {
      // Not an account this token can list; try the next.
    }
  }
  throw new Error(
    "No WhatsApp Business Account this token manages owns the phone number. " +
    "Give the System User the whatsapp_business_management permission, or set WHATSAPP_BUSINESS_ACCOUNT_ID.",
  );
}

try {
  const waba = await businessAccountId();
  if (inActions) console.log(`::add-mask::${waba}`);

  let problems = 0;
  for (const template of [PLAN_REMINDER_TEMPLATE]) {
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
  fail(error instanceof Error ? error.message : String(error));
}
