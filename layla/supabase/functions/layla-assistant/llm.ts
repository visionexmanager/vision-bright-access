import type { ChatMessage } from "./protocol.ts";

// Providers are raced. The primary starts immediately; the others start only
// when the primary is slow or has failed, so the first good answer wins and
// the cost stays low. Alexa gives up after ~8 s, so the whole race is capped.
export type LlmKeys = {
  gemini: string;
  groq?: string;
  openai?: string;
  mistral?: string;
};

type Candidate = {
  name: string;
  /** Milliseconds after the race starts before this candidate is launched. */
  delayMs: number;
  run: (signal: AbortSignal) => Promise<string>;
};

async function askGemini(
  model: string,
  apiKey: string,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
  signal: AbortSignal,
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
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      }),
      signal,
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

async function askChatCompletions(
  label: string,
  url: string,
  apiKey: string,
  model: string,
  system: string,
  messages: ChatMessage[],
  extra: Record<string, unknown>,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
      ...extra,
    }),
    signal,
  });
  if (!response.ok) throw new Error(`${label} ${model} ${response.status}`);
  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content;
  return typeof text === "string" ? text.trim() : "";
}

function candidates(
  keys: LlmKeys,
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
  spreadMs: number,
): Candidate[] {
  const list: Candidate[] = [{
    name: "gemini",
    delayMs: 0,
    run: (signal) =>
      askGemini(
        "gemini-flash-lite-latest",
        keys.gemini,
        system,
        messages,
        maxTokens,
        signal,
      ),
  }];
  if (keys.openai) {
    const key = keys.openai;
    list.push({
      name: "openai",
      delayMs: spreadMs,
      run: (signal) =>
        askChatCompletions(
          "openai",
          "https://api.openai.com/v1/chat/completions",
          key,
          "gpt-4.1-mini",
          system,
          messages,
          { max_tokens: maxTokens },
          signal,
        ),
    });
  }
  if (keys.groq) {
    const key = keys.groq;
    list.push({
      name: "groq",
      delayMs: spreadMs,
      run: (signal) =>
        askChatCompletions(
          "groq",
          "https://api.groq.com/openai/v1/chat/completions",
          key,
          "openai/gpt-oss-20b",
          system,
          messages,
          { max_tokens: maxTokens + 300, reasoning_effort: "low" },
          signal,
        ),
    });
  }
  if (keys.mistral) {
    const key = keys.mistral;
    list.push({
      name: "mistral",
      delayMs: spreadMs + 700,
      run: (signal) =>
        askChatCompletions(
          "mistral",
          "https://api.mistral.ai/v1/chat/completions",
          key,
          "mistral-small-latest",
          system,
          messages,
          { max_tokens: maxTokens },
          signal,
        ),
    });
  }
  return list;
}

/** Resolves with the first non-empty answer; rejects when all fail or time out. */
async function race(
  list: Candidate[],
  totalMs: number,
): Promise<{ name: string; text: string }> {
  const controllers: AbortController[] = [];
  const timers: number[] = [];
  const stop = () => {
    timers.forEach((t) => clearTimeout(t));
    controllers.forEach((c) => c.abort());
  };
  try {
    return await new Promise((resolve, reject) => {
      let pending = list.length;
      const settleFail = () => {
        pending -= 1;
        if (pending === 0) reject(new Error("All providers failed"));
      };
      const deadline = setTimeout(
        () => reject(new Error("All providers timed out")),
        totalMs,
      ) as unknown as number;
      timers.push(deadline);
      for (const candidate of list) {
        const controller = new AbortController();
        controllers.push(controller);
        const start = setTimeout(() => {
          candidate.run(controller.signal).then((text) => {
            if (text) resolve({ name: candidate.name, text });
            else {
              console.error("Layla provider empty:", candidate.name);
              settleFail();
            }
          }).catch((error) => {
            console.error(
              "Layla provider failed:",
              candidate.name,
              error instanceof Error ? error.message.slice(0, 60) : "unknown",
              error instanceof Error ? error.name : "",
            );
            settleFail();
          });
        }, candidate.delayMs) as unknown as number;
        timers.push(start);
      }
    });
  } finally {
    stop();
  }
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
  // Backups start after 2.2 s; everything must finish inside Alexa's window.
  const { name, text } = await race(
    candidates(keys, system, messages, 330, 2_200),
    7_000,
  );
  console.error("Layla answered by:", name);
  return text.slice(0, 7_500);
}

const MEMORY_PROMPT = (memory: string, question: string, answer: string) =>
  `مهمتك: تحديث ملف ذاكرة قصير عن مستخدم مساعدة صوتية.
القواعد:
- سجّل أي معلومة شخصية ثابتة يذكرها المستخدم: الاسم، ما يحبه أو لا يحبه، عمله أو دراسته، عائلته، مكان سكنه (المدينة فقط)، خططه الجارية، لغته.
- ادمجها مع الذاكرة القديمة واحتفظ بالقديم المفيد. اكتب جملة أو جملتين بالعربية، بحد أقصى 300 حرف.
- لا تسجّل كلمات سر ولا أرقام بطاقات أو هويات أو عناوين دقيقة ولا معلومات صحية أو مالية حساسة ولا شيئاً طلب المستخدم عدم حفظه.
- فقط إذا لم يذكر المستخدم أي معلومة شخصية جديدة، اكتب NONE.
أمثلة:
الذاكرة: (فارغة) | المستخدم: أنا اسمي سامي وبحب كرة القدم → اسمه سامي، بيحب كرة القدم.
الذاكرة: اسمه سامي، بيحب كرة القدم. | المستخدم: وبشتغل طبيب → اسمه سامي، بيحب كرة القدم، بيشتغل طبيب.
الذاكرة: اسمه سامي. | المستخدم: شو الطقس اليوم → NONE
الآن:
الذاكرة: ${
    memory || "(فارغة)"
  } | المستخدم: ${question} (ردّت المساعدة: ${answer}) →
أخرج الذاكرة المحدّثة أو NONE فقط بدون شرح.`;

/** Runs after the spoken answer has been sent, so it can take its time. */
export async function updateMemory(
  memory: string,
  question: string,
  answer: string,
  keys: LlmKeys,
): Promise<string | null> {
  const messages: ChatMessage[] = [{
    role: "user",
    content: MEMORY_PROMPT(memory, question, answer),
  }];
  try {
    const { text: raw } = await race(
      candidates(keys, "أخرج النص المطلوب فقط.", messages, 200, 3_000),
      20_000,
    );
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return null;
    if (/^NONE\b/i.test(text)) {
      console.error("Layla memory update: nothing new");
      return null;
    }
    return text.slice(0, 500);
  } catch (error) {
    console.error(
      "Layla memory update failed:",
      error instanceof Error ? error.message.slice(0, 60) : "unknown",
    );
    return null;
  }
}
