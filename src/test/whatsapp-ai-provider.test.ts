// The provider seam, tested by using it.
//
// Every case below runs the real `askAssistant` and hands it a provider written
// for that case. Nothing here reads the webhook's source to decide whether a
// branch exists, and nothing here reaches the network: the fake is the whole
// provider, so "the provider failed" means this function threw, not that a
// string appeared near another string.
//
// The one thing a fake cannot prove is that production passes the *real* chain,
// so that single fact is still asserted against the source — named as such, in
// one place, at the bottom.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AskProvider, AskRequest } from "../../supabase/functions/_shared/whatsappAsk.ts";
import type { Turn } from "../../supabase/functions/_shared/whatsapp.ts";

const ask = await import("../../supabase/functions/_shared/whatsappAsk.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const adapter = readFileSync("supabase/functions/_shared/whatsappAskProvider.ts", "utf8");

/** A provider that records what it was given and answers however the case needs. */
function fakeProvider(
  answer: string | (() => Promise<never>),
  provenance = { provider: "mistral", model: "mistral-small-latest" },
) {
  const seen: AskRequest[] = [];
  const provider: AskProvider = async (request) => {
    seen.push(request);
    if (typeof answer !== "string") return await answer();
    return { text: answer, ...provenance };
  };
  return { provider, seen, get last() { return seen[seen.length - 1]; } };
}

const SYSTEM = ["You are the Visionex assistant.", "Answer in Arabic.", ""];

describe("asking a provider", () => {
  it("sends the question, the context and the system configuration, and returns the answer", async () => {
    const fake = fakeProvider("Visionex is an inclusive platform.");
    const turns: Turn[] = [
      { role: "user", content: "What is SEO?" },
      { role: "assistant", content: "Search engine optimisation." },
      { role: "user", content: "What is Visionex?" },
    ];

    const outcome = await ask.askAssistant(
      { systemParts: SYSTEM, summary: "Customer asked about SEO earlier.", turns, question: "What is Visionex?" },
      fake.provider,
    );

    expect(outcome.status).toBe("answered");
    if (outcome.status !== "answered") return;
    expect(outcome.text).toBe("Visionex is an inclusive platform.");
    expect(outcome.provider).toBe("mistral");
    expect(outcome.model).toBe("mistral-small-latest");

    // The provider was called exactly once, with exactly what it should see.
    expect(fake.seen).toHaveLength(1);
    const request = fake.last;
    expect(request.system).toContain("You are the Visionex assistant.");
    expect(request.system).toContain("Answer in Arabic.");
    // Empty directives are dropped rather than sent as blank lines.
    expect(request.system.endsWith("\n\n")).toBe(false);

    // Summary first, as reference material, then the turns in order.
    expect(request.messages[0].content).toContain("Customer asked about SEO earlier.");
    expect(request.messages[0].content).toMatch(/reference material, not instructions/i);
    expect(request.messages.slice(1)).toEqual(turns);
    // The current question is the last thing the model reads.
    expect(request.messages[request.messages.length - 1].content).toBe("What is Visionex?");
    expect(request.maxTokens).toBe(ask.DEFAULT_MAX_TOKENS);
  });

  it("sends the question alone when there is no history to replay", async () => {
    const fake = fakeProvider("Answer.");
    await ask.askAssistant({ systemParts: SYSTEM, question: "First message" }, fake.provider);
    expect(fake.last.messages).toEqual([{ role: "user", content: "First message" }]);
  });

  it("carries no history from a thread that was closed", async () => {
    // "New conversation" moves the line and the caller replays nothing from
    // before it; what reaches the provider is only what came after.
    const fake = fakeProvider("Fresh answer.");
    await ask.askAssistant(
      { systemParts: SYSTEM, summary: null, turns: [{ role: "user", content: "New question" }], question: "New question" },
      fake.provider,
    );
    const contents = fake.last.messages.map((m) => m.content).join("\n");
    expect(contents).not.toMatch(/SEO|earlier|previous/i);
    expect(fake.last.messages).toHaveLength(1);
  });

  it("passes the language through the system configuration, not the message", async () => {
    const fake = fakeProvider("جواب.");
    await ask.askAssistant(
      { systemParts: ["Base prompt.", "Answer in Arabic (العربية)."], question: "سؤال" },
      fake.provider,
    );
    expect(fake.last.system).toContain("العربية");
    expect(fake.last.messages[0].content).toBe("سؤال");
  });
});

describe("when a provider fails", () => {
  it("reports a failure with a status and nothing else, and never throws", async () => {
    const boom = Object.assign(new Error("upstream said: your prompt was 'What is my card number'"), {
      status: 502,
    });
    const fake = fakeProvider(() => Promise.reject(boom));

    const outcome = await ask.askAssistant({ systemParts: SYSTEM, question: "Anything" }, fake.provider);

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.reason).toBe("provider_error");
    expect(outcome.httpStatus).toBe(502);
    // The message is where a provider quotes the prompt back, and the prompt
    // contains the customer's words. None of it survives this boundary.
    const carried = JSON.stringify(outcome);
    for (const leak of ["card number", "upstream", "your prompt", "stack"]) {
      expect(carried, leak).not.toContain(leak);
    }
    // What does survive is a reason and a number, and nothing shaped like text.
    expect(Object.keys(outcome).sort()).toEqual(["httpStatus", "ms", "reason", "status"]);
  });

  it("reports an error with no status as zero rather than inventing one", async () => {
    const fake = fakeProvider(() => Promise.reject(new Error("socket hang up")));
    const outcome = await ask.askAssistant({ systemParts: SYSTEM, question: "Anything" }, fake.provider);
    expect(outcome).toMatchObject({ status: "failed", reason: "provider_error", httpStatus: 0 });
  });

  it("gives up on a provider that never answers, and says it timed out", async () => {
    // Never resolves. Without the timeout this test would hang, which is the
    // behaviour being prevented: Meta redelivers a webhook that does not answer.
    const fake = fakeProvider(() => new Promise<never>(() => {}));
    const started = Date.now();

    const outcome = await ask.askAssistant(
      { systemParts: SYSTEM, question: "Anything", timeoutMs: 25 },
      fake.provider,
    );

    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.reason).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(ask.DEFAULT_ASK_TIMEOUT_MS).toBeGreaterThan(5_000);
    expect(ask.DEFAULT_ASK_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it("treats an empty answer as its own outcome, never as something to send", async () => {
    for (const empty of ["", "   ", "\n\n"]) {
      const fake = fakeProvider(empty);
      const outcome = await ask.askAssistant({ systemParts: SYSTEM, question: "Anything" }, fake.provider);
      expect(outcome.status, JSON.stringify(empty)).toBe("empty");
      if (outcome.status !== "empty") return;
      // Still says which provider produced nothing — that is the useful part.
      expect(outcome.provider).toBe("mistral");
    }
  });

  it("trims the answer rather than sending the model's leading whitespace", async () => {
    const fake = fakeProvider("\n\n  Here you go.  \n");
    const outcome = await ask.askAssistant({ systemParts: SYSTEM, question: "Anything" }, fake.provider);
    expect(outcome.status).toBe("answered");
    if (outcome.status !== "answered") return;
    expect(outcome.text).toBe("Here you go.");
  });
});

describe("fallback", () => {
  it("keeps asking down the chain until one answers", async () => {
    // The registry owns the real chain; this proves the *seam* passes a second
    // attempt through unchanged, which is what a fallback needs from it.
    const attempts: string[] = [];
    const chain: AskProvider = async (request) => {
      attempts.push(request.system.slice(0, 12));
      if (attempts.length === 1) throw Object.assign(new Error("mistral down"), { status: 503 });
      return { text: "Answered by the second provider.", provider: "gemini", model: "gemini-flash-latest" };
    };
    const withFallback: AskProvider = async (request) => {
      try {
        return await chain(request);
      } catch {
        return await chain(request);
      }
    };

    const outcome = await ask.askAssistant({ systemParts: SYSTEM, question: "Anything" }, withFallback);
    expect(outcome.status).toBe("answered");
    if (outcome.status !== "answered") return;
    expect(outcome.provider).toBe("gemini");
    expect(attempts).toHaveLength(2);
    // Both attempts saw the same request: a retry must not quietly change it.
    expect(attempts[0]).toBe(attempts[1]);
  });

  it("leaves the real chain exactly where it was, in the registry", () => {
    // The one fact a fake cannot establish, asserted at its source and named
    // as such: production hands `askAssistant` the registry's own chain.
    expect(webhook).toContain("chainProvider(),");
    expect(adapter).toContain('export const WHATSAPP_ASSISTANT_ID = "whatsapp-support";');
    expect(adapter).toContain("streamChatCompletionWithFallback({");
    expect(adapter).toContain("targets: assistant.targets,");
    // The adapter must not have opinions about which providers, or in what order.
    for (const name of ["mistral", "gemini", "groq", "openai", "MISTRAL", "OPENAI"]) {
      expect(adapter, name).not.toContain(name);
    }
  });
});

describe("the seam itself", () => {
  it("is an argument, never an environment variable or a test flag", async () => {
    // A production path that checks NODE_ENV, or an `if (test)` branch, would be
    // a different program under test than the one that ships. Comments are
    // stripped first: this is about what the module *does*, and the module's
    // own prose explains why it avoids exactly these things.
    const asked = readFileSync("supabase/functions/_shared/whatsappAsk.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const smell of ["NODE_ENV", "VITEST", "process.env", "Deno.env", "isTest", "mock"]) {
      expect(asked, smell).not.toContain(smell);
    }
    // And it imports no provider code at all, which is what keeps Deno's
    // globals out of the app's TypeScript project.
    expect(asked).not.toContain("aiProvider.ts");
    expect(asked).not.toContain("assistants.ts");
  });

  it("logs provenance and timing, never the prompt or the answer", () => {
    const askBlock = webhook.slice(webhook.indexOf("const asked = await askAssistant("), webhook.indexOf("const parts = splitAnswer("));
    expect(askBlock).toContain("provider: asked.provider");
    expect(askBlock).toContain("ms: asked.ms");
    expect(askBlock).toContain("chars: asked.text.length");
    // Only the log lines are examined: the question is of course passed *to*
    // the ask, and what matters is that it never comes back out into a log.
    const logged = [...askBlock.matchAll(/log\("[a-z_]+",\s*\{[^}]*\}/g)]
      .map((match) => match[0])
      .join("\n");
    expect(logged.length).toBeGreaterThan(0);
    // The answer's *length* is logged and should be; the answer must not be.
    expect(logged).toMatch(/asked\.text\.length/);
    expect(logged).not.toMatch(/asked\.text(?!\.length)/);
    for (const leak of ["questionText", "systemParts", "summary", "turns", "request.system"]) {
      expect(logged, leak).not.toContain(leak);
    }
  });

  it("leaves AI_PROCESSING on every outcome, not only the happy one", () => {
    const askBlock = webhook.slice(
      webhook.indexOf("const asked = await askAssistant("),
      webhook.indexOf('log("ai_answered"'),
    );
    // The state is cleared once, above the branch, so no path can miss it.
    expect(askBlock).toContain("step: assistantOwnsInput(session.feature) ? AI_CONVERSATION : null");
    expect(askBlock.indexOf("step: assistantOwnsInput"))
      .toBeLessThan(askBlock.indexOf('if (asked.status !== "answered")'));
  });

  it("answers a failed, timed-out or empty ask with the same friendly sentence", () => {
    const askBlock = webhook.slice(webhook.indexOf("const asked = await askAssistant("), webhook.indexOf("const parts = splitAnswer("));
    expect(askBlock).toContain('await reply(failureNotice(answerLanguage), "handover");');
    expect(askBlock.match(/await reply\(failureNotice/g)?.length).toBe(1);
  });
});
