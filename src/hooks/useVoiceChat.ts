/**
 * useVoiceChat — React hook wrapping the Voice Service Layer.
 *
 * All WebRTC setup is delegated to voiceService.createVoiceSession().
 * This hook only manages React state and lifecycle.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import {
  createVoiceSession,
  type VoiceSession,
  type VoiceSessionStatus,
} from "@/services/voice/voiceService";
import type { AssistantType } from "@/lib/types";
import { cancelSpeech, VOICE_SESSION_EVENT } from "@/lib/audio/speech";

export type { AssistantType };
export type { VoiceSessionStatus as VoiceStatus };

export type VoiceTranscript = {
  role: "user" | "assistant";
  text: string;
};

export function useVoiceChat(assistant: AssistantType = "visionex", assistantId?: string) {
  const [status,      setStatus]      = useState<VoiceSessionStatus>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [error,       setError]       = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const instanceIdRef = useRef(crypto.randomUUID());
  const cancelledByOtherVoiceRef = useRef(false);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
  }, []);

  useEffect(() => {
    const onOtherVoiceStart = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id !== instanceIdRef.current) {
        cancelledByOtherVoiceRef.current = true;
        disconnect();
      }
    };

    window.addEventListener(VOICE_SESSION_EVENT, onOtherVoiceStart);
    return () => {
      window.removeEventListener(VOICE_SESSION_EVENT, onOtherVoiceStart);
      disconnect();
    };
  }, [disconnect]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      cancelledByOtherVoiceRef.current = false;
      cancelSpeech();
      window.dispatchEvent(
        new CustomEvent(VOICE_SESSION_EVENT, { detail: { id: instanceIdRef.current } }),
      );
      const session = await createVoiceSession(assistant, {
        onStatus:     setStatus,
        onTranscript: (role, text) =>
          setTranscripts((prev) => [...prev, { role, text }]),
        onError:      (msg) => setError(msg),
      }, assistantId);
      if (cancelledByOtherVoiceRef.current) {
        session.disconnect();
        return;
      }
      sessionRef.current = session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setStatus("error");
    }
  }, [assistant, assistantId]);

  const clearTranscripts = useCallback(() => setTranscripts([]), []);

  return { status, transcripts, error, connect, disconnect, clearTranscripts };
}
