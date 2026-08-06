import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("AI secret deployment safety", () => {
  it("syncs the shared OpenAI key to Supabase without placing it in frontend variables", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/deploy.yml"), "utf8");

    expect(workflow).toContain("supabase secrets set OPENAI_API_KEY=\"$OPENAI_API_KEY\"");
    expect(workflow).toContain("OPENAI_API_KEY:       ${{ secrets.OPENAI_API_KEY }}");
    expect(workflow).not.toContain("VITE_OPENAI_API_KEY");
  });

  it("syncs the secondary AI provider keys without ever exposing them to the browser", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/deploy.yml"), "utf8");

    for (const name of ["GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY"]) {
      expect(workflow).toContain(`${name}:`);
      expect(workflow).not.toContain(`VITE_${name}`);
    }
  });

  it("does not reveal any API-key prefix through the public health check", () => {
    const healthCheck = readFileSync(
      resolve(root, "supabase/functions/health-check/index.ts"),
      "utf8",
    );

    expect(healthCheck).not.toMatch(/val\.slice\s*\(/);
    expect(healthCheck).toContain("`${name} is configured.`");
  });

  it("lists every AI provider key in the admin secret inventory", () => {
    const healthCheck = readFileSync(
      resolve(root, "supabase/functions/health-check/index.ts"),
      "utf8",
    );

    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY"]) {
      expect(healthCheck).toContain(`name: "${name}"`);
    }
  });
});

describe("multi-provider AI layer", () => {
  const aiProvider = readFileSync(
    resolve(root, "supabase/functions/_shared/aiProvider.ts"),
    "utf8",
  );

  it("reads every provider key from Edge Function secrets, never from a literal", () => {
    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GROQ_API_KEY", "MISTRAL_API_KEY"]) {
      expect(aiProvider).toContain(name);
    }
    // Keys are only ever resolved through Deno.env — no inline values.
    expect(aiProvider).not.toMatch(/(sk-|gsk_)[A-Za-z0-9]{8}/);
  });

  it("routes Groq and Mistral through their own endpoints", () => {
    expect(aiProvider).toContain("https://api.groq.com/openai/v1/chat/completions");
    expect(aiProvider).toContain("https://api.mistral.ai/v1/chat/completions");
  });

  it("keeps embeddings pinned to OpenAI, since stored vectors are 1536-dimensional", () => {
    expect(aiProvider).toContain('EMBEDDING_MODEL = "text-embedding-3-small"');
    expect(aiProvider).toContain("EMBEDDING_DIM = 1536");
  });

  it("does not put Groq or Mistral in the Career Center default fallback chain", () => {
    const orchestrator = readFileSync(
      resolve(root, "supabase/functions/_shared/careerAiOrchestrator.ts"),
      "utf8",
    );

    expect(orchestrator).toContain(
      'DEFAULT_PROVIDER_ORDER: CareerAiProvider[] = ["openai", "anthropic", "gemini"]',
    );
  });
});
