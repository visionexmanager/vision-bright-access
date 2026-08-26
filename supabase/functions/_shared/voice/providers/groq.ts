// Groq, running `whisper-large-v3-turbo`.
//
// First in the STT chain, and the reason is cost rather than quality: the
// repository's routing notes record it as a fraction of OpenAI's per-minute
// price *as understood when they were written*. Whether it costs accuracy in
// any given language is exactly what the baseline exists to find out.

import { whisperAdapter } from "./whisper.ts";

export const groqWhisper = whisperAdapter({
  provider: "groq",
  endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
  model: "whisper-large-v3-turbo",
  keyName: "GROQ_API_KEY",
});
