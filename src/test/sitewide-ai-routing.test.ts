import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("site-wide AI provider routing", () => {
  it("routes fast, multilingual, and safety-sensitive assistants by specialty", () => {
    const assistants = source("supabase/functions/_shared/assistants.ts");

    expect(assistants).toContain('"legal-advisor", "medical-support"');
    expect(assistants).toContain('if (OPENAI_FIRST.has(id)) return [OPENAI, MISTRAL, GROQ]');
    expect(assistants).toContain('if (MISTRAL_FIRST.has(id)) return [MISTRAL, GROQ, OPENAI]');
    expect(assistants).toContain('return [GROQ, MISTRAL, OPENAI]');
    expect(assistants).toContain('model: "llama-3.1-8b-instant"');
    expect(assistants).toContain('model: "mistral-small-latest"');
  });

  it("routes structured writing to Mistral and operational plans to Groq", () => {
    const generators = source("supabase/functions/_shared/generators.ts");

    expect(generators).toContain('"content-summary", "travel-itinerary", "marketing-campaign"');
    expect(generators).toContain('? [MISTRAL, GROQ, OPENAI]');
    expect(generators).toContain(': [GROQ, MISTRAL, OPENAI]');
  });

  it("uses automatic fallback in chat, generation, content, and WhatsApp", () => {
    const provider = source("supabase/functions/_shared/aiProvider.ts");
    const consumers = [
      "supabase/functions/ai-chat/index.ts",
      "supabase/functions/ai-voice-chat/index.ts",
      "supabase/functions/ai-generate/index.ts",
      "supabase/functions/_shared/contentEngine.ts",
      "supabase/functions/whatsapp-webhook/index.ts",
    ].map(source).join("\n");

    expect(provider).toContain("streamChatCompletionWithFallback");
    expect(provider).toContain("structuredCompletionWithFallback");
    expect(provider).toContain("for (const target of params.targets)");
    expect(consumers).toContain("streamChatCompletionWithFallback");
    expect(consumers).toContain("structuredCompletionWithFallback");
  });

  it("keeps embeddings on OpenAI to preserve vector dimensions", () => {
    const provider = source("supabase/functions/_shared/aiProvider.ts");
    expect(provider).toContain('export const EMBEDDING_MODEL = "text-embedding-3-small"');
    expect(provider).toContain('fetch("https://api.openai.com/v1/embeddings"');
  });
});
