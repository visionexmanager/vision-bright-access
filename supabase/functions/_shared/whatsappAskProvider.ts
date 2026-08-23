// The production side of the provider seam.
//
// One adapter, ten lines of substance: take the request `whatsappAsk.ts` built,
// hand it to the registry's existing fallback chain, collect the stream, and
// report which provider actually answered.
//
// What this file deliberately does **not** do is decide anything. It does not
// choose providers, order them, retry them or know their names — all of that is
// `assistantTargets("whatsapp-support")` in `assistants.ts`, which has ordered
// this assistant Mistral → Gemini → Groq → OpenAI since long before any of this
// engine work, and is passed straight through. A second place that knows the
// order would be a second thing to keep in step.
//
// It lives apart from `whatsappAsk.ts` for one concrete reason: `aiProvider.ts`
// reads `Deno.env`, and a test that imported it would drag Deno's globals into
// the app's TypeScript project. The pure module has no provider import at all,
// so a test can drive the whole ask with a function of its own.

import { collectStream } from "./whatsapp.ts";
import { streamChatCompletionWithFallback } from "./aiProvider.ts";
import { getAssistant } from "./assistants.ts";
import type { AskProvider, AskRequest, AskResult } from "./whatsappAsk.ts";

/** The assistant this channel answers as. Registered in `assistants.ts`. */
export const WHATSAPP_ASSISTANT_ID = "whatsapp-support";

/**
 * The registry's chain, as an `AskProvider`.
 *
 * Errors are left to propagate exactly as they arrive: `askAssistant` turns a
 * `ProviderError` into a status number and drops everything else about it,
 * which is the only place that decision should live.
 */
export function chainProvider(assistantId = WHATSAPP_ASSISTANT_ID): AskProvider {
  return async (request: AskRequest): Promise<AskResult> => {
    const assistant = getAssistant(assistantId);
    if (!assistant) throw new Error(`${assistantId} assistant is not registered`);

    const { result, provider, model } = await streamChatCompletionWithFallback({
      targets: assistant.targets,
      system: request.system,
      messages: request.messages.map((turn) => ({ role: turn.role, content: turn.content })),
      maxTokens: request.maxTokens,
    });

    return { text: await collectStream(result), provider, model };
  };
}
