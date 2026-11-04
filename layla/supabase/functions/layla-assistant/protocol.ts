export type AlexaEnvelope = {
  version?: string;
  session?: {
    application?: { applicationId?: string };
    attributes?: Record<string, unknown>;
  };
  context?: { System?: { application?: { applicationId?: string } } };
  request?: {
    type?: string;
    intent?: {
      name?: string;
      slots?: Record<string, { value?: string } | undefined>;
    };
  };
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_HISTORY_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 700;

export function applicationIdOf(envelope: AlexaEnvelope): string | undefined {
  return envelope.session?.application?.applicationId ??
    envelope.context?.System?.application?.applicationId;
}

export function userTextOf(envelope: AlexaEnvelope): string {
  const slots = envelope.request?.intent?.slots ?? {};
  for (const name of ["question", "query", "searchQuery"]) {
    const value = slots[name]?.value?.trim();
    if (value) return value.slice(0, MAX_MESSAGE_CHARS);
  }
  return "";
}

export function historyOf(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatMessage =>
      !!item && typeof item === "object" &&
      ((item as ChatMessage).role === "user" ||
        (item as ChatMessage).role === "assistant") &&
      typeof (item as ChatMessage).content === "string"
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item): ChatMessage => ({
      role: item.role,
      content: item.content.slice(0, MAX_MESSAGE_CHARS),
    }));
}

export function nextHistory(
  history: ChatMessage[],
  userText: string,
  answer: string,
): ChatMessage[] {
  return [
    ...history,
    { role: "user" as const, content: userText.slice(0, MAX_MESSAGE_CHARS) },
    { role: "assistant" as const, content: answer.slice(0, MAX_MESSAGE_CHARS) },
  ].slice(-MAX_HISTORY_MESSAGES);
}

export function alexaSpeechResponse(
  text: string,
  sessionAttributes: Record<string, unknown> = {},
  shouldEndSession = false,
) {
  return {
    version: "1.0",
    sessionAttributes,
    response: {
      outputSpeech: { type: "PlainText", text: text.slice(0, 7_500) },
      shouldEndSession,
      ...(shouldEndSession ? {} : {
        reprompt: {
          outputSpeech: {
            type: "PlainText",
            text: "أنا سامعتك، شو بتحب تسألني؟",
          },
        },
      }),
    },
  };
}
