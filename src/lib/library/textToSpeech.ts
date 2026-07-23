/**
 * synthesizeSpeech — calls the existing public text-to-speech edge function
 * directly via fetch() rather than supabase.functions.invoke(), because that
 * function returns raw audio/mpeg bytes, not JSON. Returns an object URL the
 * caller must revoke (URL.revokeObjectURL) once playback ends.
 *
 * fetchSpeechArrayBuffer — same call, but returns the raw ArrayBuffer
 * instead of an object URL, for callers that need to decode it via the Web
 * Audio API (AudioContext.decodeAudioData) rather than play it through a
 * plain <audio> element — see useReadAloud.ts, which needs independent
 * pitch control (AudioBufferSourceNode.detune) that a plain <audio> element
 * can't provide.
 */

interface SynthesizeOptions {
  /** Voice override — the site-wide text-to-speech function already
   *  accepts an arbitrary voice string (falls back to a per-assistant
   *  default when omitted). */
  voice?: string;
}

function buildRequest(text: string, opts?: SynthesizeOptions): { url: string; init: RequestInit } {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) throw new Error("Text-to-speech isn't configured");

  return {
    url: `${url}/functions/v1/text-to-speech`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ text, voice: opts?.voice }),
    },
  };
}

async function fetchSpeechResponse(text: string, opts?: SynthesizeOptions): Promise<Response> {
  const { url, init } = buildRequest(text, opts);
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Text-to-speech failed (${res.status})`);
  }
  return res;
}

export async function synthesizeSpeech(text: string, opts?: SynthesizeOptions): Promise<string> {
  const res = await fetchSpeechResponse(text, opts);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchSpeechArrayBuffer(text: string, opts?: SynthesizeOptions): Promise<ArrayBuffer> {
  const res = await fetchSpeechResponse(text, opts);
  return res.arrayBuffer();
}
