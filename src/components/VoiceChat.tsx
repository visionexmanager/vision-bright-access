import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { AssistantType } from "@/lib/types";

const BASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const SR_LANG: Record<string, string> = {
  en: "en-US", ar: "ar-SA", es: "es-ES", fr: "fr-FR",
  de: "de-DE", pt: "pt-BR", tr: "tr-TR", ru: "ru-RU",
  zh: "zh-CN", ur: "ur-PK", hi: "hi-IN",
};

type Props = {
  assistant?: AssistantType;
  assistantId?: string;
  assistantName?: string;
  className?: string;
};

type Transcript = { role: "user" | "assistant"; text: string };
type Status = "idle" | "listening" | "thinking" | "speaking";

const STATUS_COLOR: Record<Status, string> = {
  idle:      "bg-gray-400",
  listening: "bg-green-500 animate-pulse",
  thinking:  "bg-yellow-400 animate-pulse",
  speaking:  "bg-blue-500 animate-pulse",
};

export function VoiceChat({
  assistant = "visionex",
  assistantId,
  assistantName = "Visionex AI",
  className,
}: Props) {
  const { t, lang }  = useLanguage();
  const { user }     = useAuth();

  const [status,      setStatus]      = useState<Status>("idle");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [muted,       setMuted]       = useState(false);
  const [error,       setError]       = useState("");

  const recognitionRef    = useRef<any>(null);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const messagesRef       = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const abortRef          = useRef<AbortController | null>(null);
  const audioRef          = useRef<HTMLAudioElement | null>(null);
  const isListeningRef    = useRef(false);
  const muteRef           = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => { muteRef.current = muted; }, [muted]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    stopAudio();
    abortRef.current?.abort();
  }, []);

  function stopAudio() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
  }

  // ── Call gpt-4o-audio-preview → returns transcript + base64 MP3 ──────────
  const sendToAI = useCallback(async (userText: string) => {
    stopAudio();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus("thinking");
    messagesRef.current = [...messagesRef.current, { role: "user", content: userText }];

    try {
      const res = await fetch(`${BASE_URL}/functions/v1/ai-voice-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          messages:    messagesRef.current,
          assistant,
          assistantId,
          language:    lang,
        }),
        signal: ctrl.signal,
      });

      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(e.error || "Voice chat error");
      }

      const { transcript, audio: audioB64 } = await res.json() as {
        transcript: string;
        audio: string | null;
      };

      if (ctrl.signal.aborted) return;

      if (transcript) {
        messagesRef.current = [...messagesRef.current, { role: "assistant", content: transcript }];
        setTranscripts(prev => [...prev, { role: "assistant", text: transcript }]);
      }

      if (!audioB64 || muteRef.current) {
        setStatus("idle");
        startListeningRef.current();
        return;
      }

      // Decode base64 MP3 and play
      const binary = atob(audioB64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url  = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      setStatus("speaking");

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setStatus("idle");
        startListeningRef.current();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setStatus("idle");
        startListeningRef.current();
      };

      await audio.play();
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      setStatus("idle");
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [assistant, assistantId, lang]);

  // ── Speech Recognition ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!hasSpeech || isListeningRef.current) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = SR_LANG[lang] || "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart  = () => { setStatus("listening"); isListeningRef.current = true; };
    recognition.onend    = () => { isListeningRef.current = false; };
    recognition.onerror  = () => { isListeningRef.current = false; setStatus("idle"); };
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript.trim();
      if (!text) { setStatus("idle"); return; }
      setTranscripts(prev => [...prev, { role: "user", text }]);
      sendToAI(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [hasSpeech, lang, sendToAI]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // ── UI handlers ───────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (!user)      { setError(t("tv.toast.loginRequired")); return; }
    if (!hasSpeech) { setError("Speech recognition not supported in this browser"); return; }
    setError("");

    if (status === "listening") {
      recognitionRef.current?.stop();
      setStatus("idle");
    } else if (status === "idle") {
      startListening();
    }
  };

  const handleMuteToggle = () => {
    if (!muted) stopAudio();
    setMuted(m => !m);
  };

  const handleClear = () => {
    recognitionRef.current?.stop();
    stopAudio();
    messagesRef.current = [];
    setTranscripts([]);
    setStatus("idle");
    setError("");
  };

  const statusLabel: Record<Status, string> = {
    idle:      t("voice.status.idle"),
    listening: t("voice.status.listening"),
    thinking:  t("voice.status.connecting"),
    speaking:  t("voice.status.speaking"),
  };

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-background shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full transition-colors", STATUS_COLOR[status])} />
          <span className="font-semibold text-sm">{assistantName}</span>
          <Badge variant="secondary" className="text-xs">{statusLabel[status]}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleMuteToggle}
            aria-label={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          {transcripts.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1 min-h-[200px] max-h-[320px]">
        <div ref={scrollRef} className="space-y-3 p-4">
          {transcripts.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {status !== "idle" ? t("voice.activePrompt") : t("voice.startPrompt")}
            </div>
          )}
          {transcripts.map((tr, i) => (
            <div key={i} className={cn("flex", tr.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                tr.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              )}>
                {tr.role === "assistant" && (
                  <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                    <Volume2 className="h-3 w-3" /> {assistantName}
                  </div>
                )}
                {tr.text}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col items-center gap-2 border-t p-4">
        <div className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300",
          status === "listening" && "bg-green-100 ring-4 ring-green-300 dark:bg-green-950",
          status === "speaking"  && "bg-blue-100 ring-4 ring-blue-300 dark:bg-blue-950",
          status === "thinking"  && "bg-yellow-100 ring-4 ring-yellow-200 dark:bg-yellow-950",
          status === "idle"      && "bg-muted",
        )}>
          <Button
            onClick={handleMicToggle}
            size="icon"
            disabled={status === "thinking" || status === "speaking"}
            className={cn(
              "h-14 w-14 rounded-full text-white transition-all",
              status === "listening"
                ? "bg-red-500 hover:bg-red-600 animate-pulse"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {status === "listening" ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {status === "listening" ? t("voice.endPrompt") : t("voice.beginPrompt")}
        </p>
      </div>
    </div>
  );
}
