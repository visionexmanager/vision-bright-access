/**
 * useVoiceChat — React hook wrapping the Voice Service Layer.
 *
 * All WebRTC setup is delegated to voiceService.createVoiceSession().
 * This hook only manages React state and lifecycle.
 */
import { useState, useRef, useCallback } from "react";
import {
  createVoiceSession,
  type VoiceSession,
  type VoiceSessionStatus,
} from "@/services/voice/voiceService";
import type { AssistantType } from "@/lib/types";

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

  const connect = useCallback(async () => {
    try {
      setError(null);
      const session = await createVoiceSession(assistant, {
        onStatus:     setStatus,
        onTranscript: (role, text) =>
          setTranscripts((prev) => [...prev, { role, text }]),
        onError:      (msg) => setError(msg),
      }, assistantId);
      sessionRef.current = session;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setStatus("error");
    }
  }, [assistant, assistantId]);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
  }, []);

  const clearTranscripts = useCallback(() => setTranscripts([]), []);

  return { status, transcripts, error, connect, disconnect, clearTranscripts };
}
