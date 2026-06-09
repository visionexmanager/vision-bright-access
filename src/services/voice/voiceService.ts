/**
 * VOICE SERVICE LAYER — Unified WebRTC / OpenAI Realtime voice session management.
 *
 * RULE: All voice WebRTC setup goes through this service.
 * useVoiceChat.ts uses this service; components do not touch WebRTC directly.
 *
 * Responsibilities:
 *  - Obtain ephemeral session token via aiService.getRealtimeSession()
 *  - Set up RTCPeerConnection with microphone input + remote audio output
 *  - Maintain data channel for OpenAI event messaging
 *  - Expose connect / disconnect / send event lifecycle
 *
 * Architecture note: The WebRTC SDP exchange with OpenAI Realtime is the ONE
 * place where a non-Supabase fetch() is intentionally used — it talks directly
 * to api.openai.com/v1/realtime with an ephemeral key that cannot go through
 * our edge functions (the key IS the edge function output).
 */

import { aiService } from "@/services/ai/aiService";
import type { AssistantType } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type VoiceSessionStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export interface VoiceSessionCallbacks {
  onStatus:     (status: VoiceSessionStatus) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onError:      (message: string) => void;
}

export interface VoiceSession {
  disconnect: () => void;
  sendEvent:  (payload: Record<string, unknown>) => void;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime?model=gpt-realtime-2";

// ── Core session factory ──────────────────────────────────────────────────────

/**
 * Create and connect a WebRTC voice session with OpenAI Realtime.
 *
 * @param assistant - Which AI persona to use
 * @param callbacks - Lifecycle callbacks (status, transcripts, errors)
 * @returns VoiceSession handle with disconnect() and sendEvent()
 */
export async function createVoiceSession(
  assistant: AssistantType,
  callbacks: VoiceSessionCallbacks
): Promise<VoiceSession> {
  const { onStatus, onTranscript, onError } = callbacks;

  // ── 1. Get ephemeral key from our edge function ───────────────────────────
  onStatus("connecting");
  const sessionData = await aiService.getRealtimeSession(assistant);
  const ephemeralKey = sessionData.client_secret?.value;
  if (!ephemeralKey) throw new Error("No ephemeral key received from session");

  // ── 2. WebRTC setup ───────────────────────────────────────────────────────
  const pc = new RTCPeerConnection();

  // Remote audio → <audio> element
  const audio = new Audio();
  audio.autoplay = true;
  pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

  // Microphone input
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  // Data channel for OpenAI events
  const dc = pc.createDataChannel("oai-events");

  dc.onopen  = () => onStatus("listening");
  dc.onclose = () => onStatus("idle");

  dc.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data as string) as Record<string, unknown>;
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          onStatus("listening");
          break;
        case "response.audio.started":
          onStatus("speaking");
          break;
        case "response.audio.done":
          onStatus("listening");
          break;
        case "conversation.item.input_audio_transcription.completed":
          onTranscript("user", (event.transcript as string) || "");
          break;
        case "response.audio_transcript.done":
          onTranscript("assistant", (event.transcript as string) || "");
          break;
        case "error": {
          const err = event.error as Record<string, string> | undefined;
          onError(err?.message || "Voice error occurred");
          onStatus("error");
          break;
        }
      }
    } catch {
      // Ignore malformed events
    }
  };

  // ── 3. SDP offer / answer with OpenAI Realtime ────────────────────────────
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(OPENAI_REALTIME_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });

  if (!sdpRes.ok) throw new Error("Failed to negotiate WebRTC with OpenAI Realtime");

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  // ── 4. Return session control handle ──────────────────────────────────────
  return {
    disconnect: () => {
      stream.getTracks().forEach((t) => t.stop());
      dc.close();
      pc.close();
      audio.srcObject = null;
      onStatus("idle");
    },
    sendEvent: (payload) => {
      if (dc.readyState === "open") {
        dc.send(JSON.stringify(payload));
      }
    },
  };
}
