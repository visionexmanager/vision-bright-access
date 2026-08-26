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
 *
 * Both calls carry the signed-in user's access token. They used to send the
 * publishable key as the bearer, and that key ships in the public bundle: a
 * paid OpenAI call was reachable by anyone who read the page source,
 * attributable to nobody and counted against no quota. The edge function now
 * verifies a real user and charges their daily allowance, so read-aloud needs
 * a session.
 *
 * NOT_SIGNED_IN is thrown rather than a sentence, so a caller can tell "you
 * need an account" apart from "synthesis failed" and say so in the reader's
 * own language.
 */

import { supabase } from "@/integrations/supabase/client";

/** Thrown when there is no session to charge the synthesis to. */
export const NOT_SIGNED_IN = "NOT_SIGNED_IN";

interface SynthesizeOptions {
  /** Voice override — the site-wide text-to-speech function already
   *  accepts an arbitrary voice string (falls back to a per-assistant
   *  default when omitted). */
  voice?: string;
}

async function buildRequest(
  text: string,
  opts?: SynthesizeOptions,
): Promise<{ url: string; init: RequestInit }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) throw new Error("Text-to-speech isn't configured");

  // `apikey` still identifies the project to the gateway; the bearer is what
  // identifies the person. Two different things, and only one of them is a
  // secret to nobody.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(NOT_SIGNED_IN);

  return {
    url: `${url}/functions/v1/text-to-speech`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, voice: opts?.voice }),
    },
  };
}

async function fetchSpeechResponse(text: string, opts?: SynthesizeOptions): Promise<Response> {
  const { url, init } = await buildRequest(text, opts);
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
