import {
  alexaSpeechResponse,
  applicationIdOf,
  historyOf,
  nextHistory,
  userTextOf,
} from "./protocol.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("reads the Alexa application id from session or context", () => {
  assertEquals(applicationIdOf({ session: { application: { applicationId: "skill-1" } } }), "skill-1");
  assertEquals(applicationIdOf({ context: { System: { application: { applicationId: "skill-2" } } } }), "skill-2");
});

Deno.test("extracts a bounded free-form question", () => {
  assertEquals(userTextOf({ request: { intent: { slots: { question: { value: "مرحبا ليلى" } } } } }), "مرحبا ليلى");
  assertEquals(userTextOf({ request: { intent: { slots: { question: { value: " " }, query: { value: "hello" } } } } }), "hello");
  assertEquals(userTextOf({ request: { intent: { slots: { question: { value: "x".repeat(2_000) } } } } }).length, 1_200);
});

Deno.test("history rejects malformed roles and keeps the newest eight messages", () => {
  const input = [
    ...Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) })),
    { role: "system", content: "reject" },
    { role: "user", content: 42 },
  ];
  const result = historyOf(input);
  assertEquals(result.length, 8);
  assertEquals(result[0].content, "2");
  assertEquals(result[7].content, "9");
});

Deno.test("next history keeps the latest eight messages", () => {
  const old = Array.from({ length: 8 }, (_, i) => ({
    role: i % 2 ? "assistant" as const : "user" as const,
    content: String(i),
  }));
  const result = nextHistory(old, "new question", "new answer");
  assertEquals(result.length, 8);
  assertEquals(result[6].content, "new question");
  assertEquals(result[7].content, "new answer");
});

Deno.test("Alexa response has a reprompt while session is open", () => {
  const result = alexaSpeechResponse("أهلاً", { turn: 1 }, false);
  assertEquals(result.version, "1.0");
  assertEquals(result.sessionAttributes.turn, 1);
  assertEquals(result.response.shouldEndSession, false);
  assertEquals(result.response.outputSpeech.text, "أهلاً");
  assertEquals(!!result.response.reprompt, true);
});
