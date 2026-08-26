// The Whisper wire format, once.
//
// Groq and OpenAI expose the same multipart transcription API with the same
// field names and the same JSON response — only the host, the model and the key
// differ. Two files repeating that would be two files to fix when one of them
// changes, so the shared part lives here and `groq.ts` and `openai.ts` are the
// two configurations of it.

import type { SttAdapter, SttInput, SttOutcome } from "./types.ts";
import { denoEnv } from "./types.ts";
import type { SttProviderName } from "../capabilities.ts";
import { toBlob } from "../../whatsappAttachments.ts";

export interface WhisperConfig {
  provider: SttProviderName;
  endpoint: string;
  model: string;
  keyName: string;
}

/** One Whisper-compatible transcription provider, as an adapter. */
export function whisperAdapter(config: WhisperConfig): SttAdapter {
  return {
    provider: config.provider,
    model: config.model,
    keyName: config.keyName,

    async transcribe(input: SttInput): Promise<SttOutcome> {
      const started = Date.now();
      const since = () => Date.now() - started;

      if (!input.bytes || input.bytes.byteLength === 0) {
        return { outcome: "failed", failure: { reason: "invalid_input" }, ms: since() };
      }

      const read = input.read ?? denoEnv;
      const key = read(config.keyName);
      if (!key) {
        return { outcome: "failed", failure: { reason: "no_key", provider: config.provider }, ms: since() };
      }

      const form = new FormData();
      // `toBlob` rather than `new Blob([bytes])`: Deno's lib types reject a
      // possibly-shared buffer as a `BlobPart`, and this repository already has
      // the one helper that copies it into a plain `ArrayBuffer`.
      form.append("file", toBlob(input.bytes, input.mimeType), input.filename);
      form.append("model", config.model);
      // Sent only when the caller genuinely knows. See the note on `language`
      // in `SttInput`: a wrong hint is worse than none, because it makes the
      // model force what it heard into the language it was told to expect.
      if (input.language) form.append("language", input.language);

      try {
        const response = await (input.fetchImpl ?? fetch)(config.endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });

        if (!response.ok) {
          let detail = `HTTP ${response.status}`;
          try {
            const body = await response.json() as { error?: { message?: string } };
            detail = body?.error?.message ?? detail;
          } catch {
            // A provider that answers an error with something other than JSON
            // tells us nothing useful; the status is the whole message.
          }
          return {
            outcome: "failed",
            failure: { reason: "rejected", provider: config.provider, status: response.status, detail },
            ms: since(),
          };
        }

        const body = await response.json() as { text?: string };
        const text = (body.text ?? "").trim();
        // An empty transcript is a real outcome — silence, or noise — and is
        // reported as such rather than passed on as an empty question.
        if (!text) {
          return { outcome: "failed", failure: { reason: "empty", provider: config.provider }, ms: since() };
        }
        return { outcome: "transcript", text, provider: config.provider, model: config.model, ms: since() };
      } catch {
        return { outcome: "failed", failure: { reason: "transport", provider: config.provider }, ms: since() };
      }
    },
  };
}
