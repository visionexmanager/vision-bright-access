// OpenAI, running `whisper-1`.
//
// The fallback in the WhatsApp chain and the only provider the website's
// `speech-transcribe` has ever used. Same wire format as Groq, different host
// and model.

import { whisperAdapter } from "./whisper.ts";

export const openaiWhisper = whisperAdapter({
  provider: "openai",
  endpoint: "https://api.openai.com/v1/audio/transcriptions",
  model: "whisper-1",
  keyName: "OPENAI_API_KEY",
});
