import { useEffect } from "react";
import { Loader2, Pause, Play, Square, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useReadAloud } from "@/hooks/library/useReadAloud";
import { useVoiceCommands } from "@/hooks/library/useVoiceCommands";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";

interface ReadAloudControlsProps {
  bookId: string;
  text: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral"];

/** AI read-aloud for books with no audiobook edition — reuses the existing
 *  text-to-speech edge function via useReadAloud (Web Audio API engine,
 *  independent speed/pitch, sentence-chunked so highlight-sync and
 *  next-sentence prefetch are both accurate). Voice commands are scoped to
 *  this panel's own playback controls (play/pause/stop/faster/slower) —
 *  see useVoiceCommands' header note on why reader-wide navigation commands
 *  are out of scope here. */
export function ReadAloudControls({ bookId, text }: ReadAloudControlsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const {
    isPlaying, isLoading, currentSentenceIndex, sentenceCount,
    speed, pitch, voice, play, pause, resume, stop, setSpeed, setPitch, setVoice,
  } = useReadAloud(text);

  useEffect(() => {
    if (isPlaying && currentSentenceIndex === 0) {
      void logLibraryAnalyticsEvent("read_aloud_started", { userId: user?.id ?? null, entityType: "book", entityId: bookId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentSentenceIndex === 0]);

  const handleToggle = () => {
    if (isPlaying) pause();
    else if (currentSentenceIndex >= 0) resume();
    else play();
  };

  const { supported: voiceCommandsSupported, isListening: isListeningForCommands, lastCommand, toggle: toggleVoiceCommands } = useVoiceCommands({
    // Command vocabulary below is English-only regardless of the app's UI
    // language — forcing en-US here (rather than the app locale) avoids
    // asking the recognizer to transcribe English keywords as if they were
    // Arabic/Chinese/etc, which would otherwise silently never match.
    // Known limitation: listening for commands while the book is being
    // read aloud through speakers can pick up the TTS audio itself — same
    // mic-echo tradeoff any simultaneous voice-command + audio-output
    // feature has; headphones avoid it.
    lang: "en-US",
    commands: {
      play: () => { if (!isPlaying) handleToggle(); },
      pause: () => { if (isPlaying) pause(); },
      stop: () => stop(),
      faster: () => setSpeed(Math.min(2, speed + 0.25)),
      slower: () => setSpeed(Math.max(0.5, speed - 0.25)),
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={stop} disabled={currentSentenceIndex < 0 && !isPlaying} aria-label={t("library.player.stop")}>
          <Square className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="icon" className="h-12 w-12 rounded-full" onClick={handleToggle} disabled={isLoading} aria-label={isPlaying ? t("library.player.pause") : t("library.player.play")}>
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : isPlaying ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </Button>
        {voiceCommandsSupported && (
          <Button
            variant={isListeningForCommands ? "default" : "outline"}
            size="icon"
            className="h-10 w-10 rounded-full"
            onClick={toggleVoiceCommands}
            aria-pressed={isListeningForCommands}
            aria-label={isListeningForCommands ? t("library.ai.voiceCommands.stop") : t("library.ai.voiceCommands.start")}
          >
            {isListeningForCommands ? <Mic className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <MicOff className="h-4 w-4" aria-hidden="true" />}
          </Button>
        )}
      </div>

      {sentenceCount > 0 && (
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {currentSentenceIndex >= 0 ? `${currentSentenceIndex + 1} / ${sentenceCount}` : sentenceCount}
        </p>
      )}

      {voiceCommandsSupported && isListeningForCommands && (
        <p className="text-center text-xs text-muted-foreground" aria-live="polite">
          {lastCommand ? t("library.ai.voiceCommands.heard").replace("{command}", lastCommand) : t("library.ai.voiceCommands.listening")}
        </p>
      )}

      <div className="flex items-center justify-center gap-1" role="group" aria-label={t("library.player.speed")}>
        {SPEEDS.map((s) => (
          <Button key={s} variant={speed === s ? "default" : "outline"} size="sm" onClick={() => setSpeed(s)} aria-pressed={speed === s}>
            {s}x
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="read-aloud-pitch" className="block text-center text-xs text-muted-foreground">{t("library.player.pitch")}</label>
        <Slider
          id="read-aloud-pitch"
          value={[pitch]}
          min={-600}
          max={600}
          step={50}
          onValueChange={([v]) => setPitch(v)}
          aria-label={t("library.player.pitch")}
        />
      </div>

      <Select value={voice} onValueChange={setVoice}>
        <SelectTrigger aria-label={t("library.player.voice")}><SelectValue /></SelectTrigger>
        <SelectContent>
          {VOICES.map((v) => (
            <SelectItem key={v} value={v}>{t(`library.player.voiceName.${v}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
