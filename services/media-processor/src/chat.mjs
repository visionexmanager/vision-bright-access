// Answering a conversation on the server's own model.
//
// The model is Qwen3-4B-Instruct (llama.cpp, Q4_K_M, CPU), measured on this
// server in scripts/llm-benchmark: about 13 tokens a second, 11 of 11 test
// answers right, and a prompt read at only ~33 tokens a second. That last
// number decides the shape of this module: a long prompt is slow, so the
// request is bounded hard (a short system part, a few recent turns) rather
// than forwarded as the paid providers receive it.
//
// It is a fallback tier behind the paid chain, never a replacement, so it is
// allowed to refuse: the caller goes back to the chain on `busy`.

export const MAX_CHAT_BODY_BYTES = 64 * 1024;
export const MAX_SYSTEM_CHARS = 1_800;
export const MAX_TURN_CHARS = 1_200;
export const MAX_TURNS = 8;
/** All the replayed turns together; the prompt is read at ~33 tokens a second. */
export const MAX_HISTORY_CHARS = 2_400;
export const MAX_CHAT_TOKENS = 320;
export const DEFAULT_CHAT_TOKENS = 200;
export const MAX_CHAT_ANSWER_CHARS = 3_000;
/** Two requests at once measured 5.3 s each; a third would only slow both. */
export const MAX_CONCURRENT_CHATS = 2;
export const CHAT_TIMEOUT_MS = 60_000;

const ROLES = new Set(["user", "assistant"]);

/** The request body, or why it is not acceptable. Everything is re-bounded here. */
export function checkChatRequest(body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "bad_request" };
  const { system, messages, max_tokens: maxTokens } = body;
  if (typeof system !== "string" || !Array.isArray(messages) || messages.length === 0) {
    return { ok: false, reason: "bad_request" };
  }
  const turns = [];
  for (const m of messages.slice(-MAX_TURNS)) {
    if (!m || typeof m !== "object" || !ROLES.has(m.role) || typeof m.content !== "string") {
      return { ok: false, reason: "bad_request" };
    }
    const content = m.content.trim().slice(0, MAX_TURN_CHARS);
    if (content) turns.push({ role: m.role, content });
  }
  // Keep the newest turns that fit the budget; the question itself is last.
  const kept = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (kept.length > 0 && used + turns[i].content.length > MAX_HISTORY_CHARS) break;
    used += turns[i].content.length;
    kept.unshift(turns[i]);
  }
  if (kept.length === 0 || kept[kept.length - 1].role !== "user") return { ok: false, reason: "bad_request" };
  const tokens = Number.isFinite(maxTokens) ? Math.floor(maxTokens) : DEFAULT_CHAT_TOKENS;
  return {
    ok: true,
    system: system.trim().slice(0, MAX_SYSTEM_CHARS),
    messages: kept,
    maxTokens: Math.min(Math.max(tokens, 16), MAX_CHAT_TOKENS),
  };
}

/** The llama.cpp request. Thinking is off: a spoken reply cannot wait for hidden reasoning. */
export function chatRequestBody({ system, messages, maxTokens }) {
  return {
    messages: [...(system ? [{ role: "system", content: system }] : []), ...messages],
    max_tokens: maxTokens,
    temperature: 0.4,
    stream: false,
    chat_template_kwargs: { enable_thinking: false },
  };
}

/** The model's text, with any reasoning block removed, or null when nothing worth sending is left. */
export function readChatAnswer(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  const text = content.replace(/<think>[\s\S]*?<\/think>/gu, "").trim().slice(0, MAX_CHAT_ANSWER_CHARS);
  return text.replace(/[^\p{L}\p{N}]/gu, "").length >= 1 ? text : null;
}
