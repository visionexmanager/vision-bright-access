// A search phrase in English, for a request in a script the open catalogues do not
// index (an Arabic title is rarely on a Commons file). One short call through the
// assistant's own provider chain; anything but a clean answer is null, and the
// search then runs as the sender wrote it.

import { askAssistant, type AskProvider } from "./whatsappAsk.ts";
import { chainProvider } from "./whatsappAskProvider.ts";

export const translateQuery = (provider: AskProvider) => async (query: string): Promise<string | null> => {
  const rendered = await askAssistant(
    {
      systemParts: ["Translate the user's text into English. Reply with the translation only: no quotes, no notes, no punctuation added."],
      question: query,
      maxTokens: 40,
      timeoutMs: 8_000,
    },
    provider,
  );
  return rendered.status === "answered" ? rendered.text : null;
};

/** The translator on the assistant's provider chain, as the webhook hands it to a search. */
export const translateWithChain = (query: string): Promise<string | null> => translateQuery(chainProvider())(query);
