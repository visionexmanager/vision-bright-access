import { supabase } from "@/integrations/supabase/client";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Reuses the site's existing text-to-speech function (gpt-4o-mini-tts) —
 *  no bespoke kids TTS endpoint. Returns a Blob URL ready for an <audio>. */
export async function textToSpeech(text: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("text-to-speech", { body: { text, assistant: "visionex" } });
  if (error) throw error;
  const blob = data instanceof Blob ? data : new Blob([data], { type: "audio/mpeg" });
  return URL.createObjectURL(blob);
}

/** Reuses the site's existing speech-transcribe function (Whisper). */
export async function speechToText(blob: Blob): Promise<string> {
  const audio_base64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke("speech-transcribe", {
    body: { audio_base64, mime_type: blob.type || "audio/webm", filename: "recording.webm" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.transcript_text as string;
}
