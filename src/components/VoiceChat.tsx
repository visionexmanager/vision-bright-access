import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Volume2, VolumeX, RotateCcw, Hand } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSSEStream } from "@/lib/api/useSSEStream";
import { aiService } from "@/services/ai/aiService";
import { cn } from "@/lib/utils";
import type { AssistantType } from "@/lib/types";

const BASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const ASSISTANT_VOICE: Record<string, string> = {
  visionex: "nova", munir: "echo", nutrition: "coral",
  radar: "alloy", ocr: "alloy", mentor: "shimmer",
};

const SR_LANG: Record<string, string> = {
  en: "en-US", ar: "ar-SA", es: "es-ES", fr: "fr-FR",
  de: "de-DE", pt: "pt-BR", tr: "tr-TR", ru: "ru-RU",
  zh: "zh-CN", ur: "ur-PK", hi: "hi-IN",
};

// Detect sentence boundaries (Arabic + Latin)
function extractSentences(buf: string): { ready: string[]; remaining: string } {
  const boundary = /[.!?؟\n]/;
  let last = -1;
  for (let i = 0; i < buf.length; i++) if (boundary.test(buf[i])) last = i;
  if (last === -1) return { ready: [], remaining: buf };
  const done = buf.slice(0, last + 1);
  const remaining = buf.slice(last + 1).trimStart();
  const ready = done.split(/[.!?؟\n]+/).map(s => s.trim()).filter(s => s.length > 3);
  return { ready, remaining };
}

type Props = {
  assistant?: AssistantType;
  assistantId?: string;
  assistantName?: string;
  className?: string;
};

type Transcript = { role: "user" | "assistant"; text: string; _id?: string };
type Status = "idle" | "listening" | "thinking" | "speaking";

interface Segment { url: string | null; ready: boolean; error: boolean }

export function VoiceChat({ assistant = "visionex", assistantId, assistantName = "Visionex AI", className }: Props) {
  const { t, lang }       = useLanguage();
  const { user }          = useAuth();
  const { consumeStream } = useSSEStream();

  const [status,      setStatus]      = useState<Status>("idle");
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [muted,       setMuted]       = useState(false);
  const [error,       setError]       = useState("");

  const recognitionRef    = useRef<any>(null);
  const scrollRef         = useRef<HTMLDivElement>(null);
  const messagesRef       = useRef<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const aiAbortRef        = useRef<AbortController | null>(null);
  const ttsAbortRef       = useRef<AbortController | null>(null);
  const isListeningRef    = useRef(false);
  const muteRef           = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  // Audio queue
  const segmentsRef       = useRef<Segment[]>([]);
  const playHeadRef       = useRef(0);
  const isPlayingRef      = useRef(false);
  const isGeneratingRef   = useRef(false);
  const currentAudioRef   = useRef<HTMLAudioElement | null>(null);

  const hasSpeech = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  useEffect(() => { muteRef.current = muted; }, [muted]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcripts]);
  useEffect(() => () => { stopAll(); aiAbortRef.current?.abort(); }, []);

  // ── Stop everything ───────────────────────────────────────────────────────
  function stopAll() {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    for (const seg of segmentsRef.current) {
      if (seg.url) { URL.revokeObjectURL(seg.url); seg.url = null; }
    }
    segmentsRef.current  = [];
    playHeadRef.current  = 0;
    isPlayingRef.current = false;
    isGeneratingRef.current = false;
  }

  // ── Audio queue player ────────────────────────────────────────────────────
  function tryPlayNext() {
    if (muteRef.current || isPlayingRef.current) return;
    const segments = segmentsRef.current;
    const idx = playHeadRef.current;

    if (idx >= segments.length) {
      if (!isGeneratingRef.current) { setStatus("idle"); startListeningRef.current(); }
      return;
    }

    const seg = segments[idx];
    if (!seg.ready) return;
    if (seg.error || !seg.url) { playHeadRef.current++; tryPlayNext(); return; }

    isPlayingRef.current = true;
    setStatus("speaking");

    const audio = new Audio(seg.url);
    currentAudioRef.current = audio;

    const advance = () => {
      if (seg.url) { URL.revokeObjectURL(seg.url); seg.url = null; }
      isPlayingRef.current    = false;
      currentAudioRef.current = null;
      playHeadRef.current++;
      tryPlayNext();
    };
    audio.onended = advance;
    audio.onerror = advance;
    audio.play().catch(advance);
  }

  // Fetch one sentence → fill slot → tryPlayNext
  async function fetchSegment(text: string, idx: number, voice: string, signal: AbortSignal) {
    const seg = segmentsRef.current[idx];
    try {
      const res = await fetch(`${BASE_URL}/functions/v1/text-to-speech`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        body: JSON.stringify({ text, voice, assistant }),
        signal,
      });
      if (signal.aborted || !res.ok) { seg.error = true; }
      else {
        const blob = await res.blob();
        if (signal.aborted) { seg.error = true; }
        else { seg.url = URL.createObjectURL(blob); }
      }
    } catch { seg.error = true; }
    seg.ready = true;
    tryPlayNext();
  }

  function queueSentence(text: string, voice: string, signal: AbortSignal) {
    if (muteRef.current) return;
    const idx = segmentsRef.current.length;
    segmentsRef.current.push({ url: null, ready: false, error: false });
    fetchSegment(text, idx, voice, signal);
  }

  // ── Send to AI — stream jملة بجملة → TTS queue ───────────────────────────
  const sendToAI = useCallback(async (userText: string) => {
    stopAll();
    recognitionRef.current?.stop();

    const aiCtrl  = new AbortController();
    const ttsCtrl = new AbortController();
    aiAbortRef.current  = aiCtrl;
    ttsAbortRef.current = ttsCtrl;

    isGeneratingRef.current = true;
    setStatus("thinking");
    setError("");

    messagesRef.current = [...messagesRef.current, { role: "user", content: userText }];

    const replyId   = crypto.randomUUID();
    let accumulated = "";
    let sentBuf     = "";
    const voice     = ASSISTANT_VOICE[assistant] || "nova";

    try {
      const response = await aiService.streamChat(
        messagesRef.current,
        { language: lang, voiceMode: true, ...(assistantId ? { assistantId } : {}) } as any,
        aiCtrl.signal
      );

      await consumeStream(response, {
        onToken: (tok, acc) => {
          accumulated = acc;
          sentBuf += tok;

          // Live transcript update
          setTranscripts(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && last._id === replyId)
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, text: acc } : m);
            return [...prev, { role: "assistant" as const, text: acc, _id: replyId }];
          });

          // Queue complete sentences to TTS immediately
          const { ready, remaining } = extractSentences(sentBuf);
          sentBuf = remaining;
          for (const s of ready) queueSentence(s, voice, ttsCtrl.signal);
        },
        onError: (err) => { setError(err.message); setStatus("idle"); },
      });

      // Flush remainder
      if (sentBuf.trim().length > 2) queueSentence(sentBuf.trim(), voice, ttsCtrl.signal);

      if (accumulated) {
        messagesRef.current = [...messagesRef.current, { role: "assistant", content: accumulated }];
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setStatus("idle");
    } finally {
      isGeneratingRef.current = false;
      if (segmentsRef.current.length === 0) {
        setStatus("idle");
        startListeningRef.current();
      } else {
        tryPlayNext();
      }
    }
  }, [lang, assistantId, consumeStream, assistant]);

  // ── Speech Recognition ────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!hasSpeech || isListeningRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = SR_LANG[lang] || "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onstart  = () => { setStatus("listening"); isListeningRef.current = true; };
    r.onend    = () => { isListeningRef.current = false; };
    r.onerror  = () => { isListeningRef.current = false; setStatus("idle"); };
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript.trim();
      if (!text) { setStatus("idle"); return; }
      setTranscripts(prev => [...prev, { role: "user", text }]);
      sendToAI(text);
    };
    recognitionRef.current = r;
    r.start();
  }, [hasSpeech, lang, sendToAI]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleMicToggle = () => {
    if (!user)      { setError(t("tv.toast.loginRequired")); return; }
    if (!hasSpeech) { setError("Speech recognition not supported in this browser"); return; }
    setError("");

    if (status === "speaking") {
      // INTERRUPT: stop audio immediately, start listening
      stopAll();
      startListening();
    } else if (status === "listening") {
      recognitionRef.current?.stop();
      setStatus("idle");
    } else if (status === "idle") {
      startListening();
    }
    // status === "thinking": do nothing (wait for AI)
  };

  const handleMuteToggle = () => {
    if (!muted) { currentAudioRef.current?.pause(); }
    setMuted(m => !m);
  };

  const handleClear = () => {
    recognitionRef.current?.stop();
    stopAll();
    aiAbortRef.current?.abort();
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

  const micIcon = status === "listening"
    ? <MicOff className="h-6 w-6" />
    : status === "speaking"
      ? <Hand className="h-6 w-6" />
      : <Mic className="h-6 w-6" />;

  const micClass = cn(
    "h-14 w-14 rounded-full text-white transition-all",
    status === "listening" && "bg-red-500 hover:bg-red-600 animate-pulse",
    status === "speaking"  && "bg-orange-500 hover:bg-orange-600",
    (status === "idle" || status === "thinking") && "bg-primary hover:bg-primary/90",
  );

  return (
    <div className={cn("flex flex-col rounded-2xl border bg-background shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full transition-colors", {
            "bg-gray-400":                  status === "idle",
            "bg-green-500 animate-pulse":   status === "listening",
            "bg-yellow-400 animate-pulse":  status === "thinking",
            "bg-blue-500 animate-pulse":    status === "speaking",
          })} />
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
          status === "listening" && "bg-red-100 ring-4 ring-red-300 dark:bg-red-950",
          status === "speaking"  && "bg-orange-100 ring-4 ring-orange-300 dark:bg-orange-950",
          status === "thinking"  && "bg-yellow-100 ring-4 ring-yellow-200 dark:bg-yellow-950",
          status === "idle"      && "bg-muted",
        )}>
          <Button
            onClick={handleMicToggle}
            size="icon"
            disabled={status === "thinking"}
            className={micClass}
          >
            {micIcon}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {status === "listening" && t("voice.endPrompt")}
          {status === "speaking"  && "اضغط للمقاطعة / Tap to interrupt"}
          {status === "idle"      && t("voice.beginPrompt")}
          {status === "thinking"  && "…"}
        </p>
      </div>
    </div>
  );
}
