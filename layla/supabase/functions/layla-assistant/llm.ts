import type { ChatMessage } from "./protocol.ts";

// Alexa gives up after about 8 seconds, so every attempt gets a short budget
// and the next provider is only tried when the previous one fails or is slow.
export type LlmKeys = { gemini: string; groq?: string };

const GEMINI_ATTEMPTS: [string, number][] = [
  ["gemini-flash-lite-latest", 3_500],
];
const GROQ_ATTEMPT: [string, number] = ["openai/gpt-oss-20b", 3_000];

async function askGemini(
  model: string,
  budgetMs: number,
  apiKey: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: { maxOutputTokens: 330, temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(budgetMs),
    },
  );
  if (!response.ok) throw new Error(`gemini ${model} ${response.status}`);
  const result = await response.json();
  const parts = result?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((part: { text?: unknown }) =>
      typeof part.text === "string" ? part.text : ""
    ).join("").trim()
    : "";
}

async function askGroq(
  model: string,
  budgetMs: number,
  apiKey: string,
  system: string,
  messages: ChatMessage[],
): Promise<string> {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: 600,
        temperature: 0.7,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(budgetMs),
    },
  );
  if (!response.ok) throw new Error(`groq ${model} ${response.status}`);
  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

export async function answerQuestion(
  history: ChatMessage[],
  question: string,
  keys: LlmKeys,
  system: string,
): Promise<string> {
  const messages: ChatMessage[] = [...history, {
    role: "user",
    content: question,
  }];
  const attempts: (() => Promise<string>)[] = GEMINI_ATTEMPTS.map(
    ([model, budget]) => () =>
      askGemini(model, budget, keys.gemini, system, messages),
  );
  if (keys.groq) {
    const groqKey = keys.groq;
    attempts.push(() =>
      askGroq(GROQ_ATTEMPT[0], GROQ_ATTEMPT[1], groqKey, system, messages)
    );
  }
  for (const attempt of attempts) {
    try {
      const answer = await attempt();
      if (answer) return answer.slice(0, 7_500);
      console.error("Layla provider returned an empty answer");
    } catch (error) {
      // Only the provider, model and status/error name are logged.
      console.error(
        "Layla provider attempt failed:",
        error instanceof Error ? error.message.slice(0, 80) : "unknown",
        error instanceof Error ? error.name : "",
      );
    }
  }
  throw new Error("All providers failed");
}
