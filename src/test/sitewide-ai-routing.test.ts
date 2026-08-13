import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

describe("site-wide AI provider routing", () => {
  it("routes fast, multilingual, multimodal, and safety-sensitive assistants by specialty", () => {
    const assistants = source("supabase/functions/_shared/assistants.ts");

    expect(assistants).toContain('"legal-advisor", "medical-support"');
    expect(assistants).toContain('"travel-agency", "educational-empire", "music-conservatory", "tech-consulting"');
    expect(assistants).toContain('if (OPENAI_FIRST.has(id)) return [OPENAI, GEMINI, MISTRAL, GROQ]');
    expect(assistants).toContain('if (GEMINI_FIRST.has(id)) return [GEMINI, GROQ, MISTRAL, OPENAI]');
    expect(assistants).toContain('if (MISTRAL_FIRST.has(id)) return [MISTRAL, GEMINI, GROQ, OPENAI]');
    expect(assistants).toContain('return [GROQ, GEMINI, MISTRAL, OPENAI]');
    expect(assistants).toContain('model: "gemini-flash-latest"');
    expect(assistants).toContain('model: "llama-3.1-8b-instant"');
    expect(assistants).toContain('model: "mistral-small-latest"');
  });

  it("routes research plans to Gemini, writing to Mistral, and operational work to Groq", () => {
    const generators = source("supabase/functions/_shared/generators.ts");

    expect(generators).toContain('"travel-itinerary", "career-roadmap", "tech-troubleshooting-plan"');
    expect(generators).toContain('if (GEMINI_GENERATORS.has(id)) return [GEMINI, GROQ, MISTRAL, OPENAI]');
    expect(generators).toContain('if (MISTRAL_GENERATORS.has(id)) return [MISTRAL, GEMINI, GROQ, OPENAI]');
    expect(generators).toContain('return [GROQ, GEMINI, MISTRAL, OPENAI]');
  });

  it("uses Gemini first for image analysis with OpenAI fallback", () => {
    const analysts = source("supabase/functions/_shared/visionAnalysts.ts");
    const analyzeImage = source("supabase/functions/analyze-image/index.ts");

    expect(analysts).toContain('{ provider: "gemini", model: "gemini-flash-latest" }');
    expect(analysts).toContain('{ provider: "openai", model: "gpt-4o" }');
    expect(analyzeImage).toContain("structuredCompletionWithFallback");
    expect(analyzeImage).toContain("targets: analyst.targets");
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
