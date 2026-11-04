import {
  alexaSpeechResponse,
  applicationIdOf,
  historyOf,
  nextHistory,
  userTextOf,
} from "./protocol.ts";
import { assertEquals } from "jsr:@std/assert@1";

Deno.test("reads the Alexa application id from session or context", () => {
  assertEquals(
    applicationIdOf({ session: { application: { applicationId: "skill-1" } } }),
    "skill-1",
  );
  assertEquals(
    applicationIdOf({
      context: { System: { application: { applicationId: "skill-2" } } },
    }),
    "skill-2",
  );
});

Deno.test("extracts a bounded free-form question", () => {
  assertEquals(
    userTextOf({
      request: { intent: { slots: { question: { value: "مرحبا ليلى" } } } },
    }),
    "مرحبا ليلى",
  );
  assertEquals(
    userTextOf({
      request: {
        intent: {
          slots: { question: { value: " " }, query: { value: "hello" } },
        },
      },
    }),
    "hello",
  );
  assertEquals(
    userTextOf({
      request: {
        intent: { slots: { question: { value: "x".repeat(2_000) } } },
      },
    }).length,
    700,
  );
});

Deno.test("history rejects malformed roles and keeps the newest sixteen messages", () => {
  const input = [
    ...Array.from(
      { length: 20 },
      (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) }),
    ),
    { role: "system", content: "reject" },
    { role: "user", content: 42 },
  ];
  const result = historyOf(input);
  assertEquals(result.length, 16);
  assertEquals(result[0].content, "4");
  assertEquals(result[15].content, "19");
});

Deno.test("next history keeps the latest sixteen messages", () => {
  const old = Array.from({ length: 16 }, (_, i) => ({
    role: i % 2 ? "assistant" as const : "user" as const,
    content: String(i),
  }));
  const result = nextHistory(old, "new question", "new answer");
  assertEquals(result.length, 16);
  assertEquals(result[14].content, "new question");
  assertEquals(result[15].content, "new answer");
});

Deno.test("Alexa response has a reprompt while session is open", () => {
  const result = alexaSpeechResponse("أهلاً", { turn: 1 }, false);
  assertEquals(result.version, "1.0");
  assertEquals(result.sessionAttributes.turn, 1);
  assertEquals(result.response.shouldEndSession, false);
  assertEquals(result.response.outputSpeech.text, "أهلاً");
  assertEquals(!!result.response.reprompt, true);
});
