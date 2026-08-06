#!/usr/bin/env node
//
// Print the models each configured key can actually use.
//
//   node scripts/ai-eval/list-models.mjs
//   node scripts/ai-eval/list-models.mjs --provider gemini --filter flash
//
// Model listing is free on every provider here, and it answers a question that
// otherwise only surfaces as a failed generation: the first eval run died on
// `models/gemini-2.5-flash is no longer available to new users`, a model id
// that had been hardcoded in the edge layer. A list is cheaper than a stale
// constant.
//
// Prints names only. No key is echoed, and no generation is performed.

import { GEMINI_API_BASE, envKeyFor, extractModelNames } from "./providers.mjs";

const LISTERS = {
  openai: () => ({ url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }),
  groq: () => ({ url: "https://api.groq.com/openai/v1/models", headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } }),
  mistral: () => ({ url: "https://api.mistral.ai/v1/models", headers: { Authorization: `Bearer ${process.env.MISTRAL_API_KEY}` } }),
  gemini: () => ({ url: `${GEMINI_API_BASE}/models?pageSize=200`, headers: { "x-goog-api-key": process.env.GEMINI_API_KEY } }),
};

async function listFor(provider) {
  const { url, headers } = LISTERS[provider]();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return extractModelNames(await res.json()).sort();
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes("--provider") ? argv[argv.indexOf("--provider") + 1] : null;
  const filter = argv.includes("--filter") ? argv[argv.indexOf("--filter") + 1] : null;

  const providers = (only ? [only] : Object.keys(LISTERS)).filter((p) => {
    const key = envKeyFor(p);
    if (process.env[key]) return true;
    console.log(`### ${p}\n\n_Skipped: ${key} not configured._\n`);
    return false;
  });

  for (const provider of providers) {
    console.log(`### ${provider}\n`);
    try {
      let models = await listFor(provider);
      if (filter) models = models.filter((m) => m.includes(filter));
      console.log(models.length ? models.map((m) => `- \`${m}\``).join("\n") : "_No models returned._");
    } catch (e) {
      console.log(`_Failed: ${e.message}_`);
    }
    console.log("");
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
