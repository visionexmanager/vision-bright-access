import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

export type VoiceTranscript = {
  role: "user" | "assistant";
  text: string;
};

export type AssistantType = "visionex" | "munir" | "nutrition";

export function useVoiceChat(assistant: AssistantType = "visionex") {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addTranscript = useCallback((role: "user" | "assistant", text: string) => {
    setTranscripts(prev => [...prev, { role, text }]);
  }, []);

  const connect = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      // Get ephemeral token from our edge function
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ assistant }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create session");
      }

      const { client_secret } = await res.json();
      const ephemeralKey = client_secret?.value;
      if (!ephemeralKey) throw new Error("No ephemeral key received");

      // Setup WebRTC
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio output
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;

      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
      };

      // Microphone input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => setStatus("listening");
      dc.onclose = () => setStatus("idle");

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === "input_audio_buffer.speech_started") {
            setStatus("listening");
          }
          if (event.type === "response.audio.started") {
            setStatus("speaking");
          }
          if (event.type === "response.audio.done") {
            setStatus("listening");
          }
          if (event.type === "conversation.item.input_audio_transcription.completed") {
            addTranscript("user", event.transcript || "");
          }
          if (event.type === "response.audio_transcript.done") {
            addTranscript("assistant", event.transcript || "");
          }
          if (event.type === "error") {
            setError(event.error?.message || "Error occurred");
            setStatus("error");
          }
        } catch {
          // ignore parse errors
        }
      };

      // Create SDP offer and connect to OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      if (!sdpRes.ok) throw new Error("Failed to connect to OpenAI Realtime");

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setStatus("error");
      disconnect();
    }
  }, [assistant, addTranscript]);

  const disconnect = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    pcRef.current = null;
    dcRef.current = null;
    streamRef.current = null;
    setStatus("idle");
  }, []);

  const clearTranscripts = useCallback(() => setTranscripts([]), []);

  return { status, transcripts, error, connect, disconnect, clearTranscripts };
}
