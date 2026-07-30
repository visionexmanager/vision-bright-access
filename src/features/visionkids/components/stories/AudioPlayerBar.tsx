import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Timer, Gauge, List, Bookmark as BookmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import type { StoryChapter } from "@/features/visionkids/types/stories.types";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const SLEEP_OPTIONS = [5, 10, 15, 30, 45];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioPlayerBarProps {
  audioUrl: string;
  title: string;
  coverImageUrl?: string | null;
  chapters?: StoryChapter[];
  startPositionSeconds?: number;
  onBookmark?: (positionSeconds: number) => void;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
}

export function AudioPlayerBar({ audioUrl, title, coverImageUrl, chapters = [], startPositionSeconds = 0, onBookmark, onProgress }: AudioPlayerBarProps) {
  const { t } = useLanguage();
  const audioRef = useRef<HTMLAudioElement>(null);
  const sleepTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(startPositionSeconds);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && startPositionSeconds > 0) audio.currentTime = startPositionSeconds;
  }, [startPositionSeconds]);

  // Media Session API — OS/lock-screen media controls, the real mechanism
  // behind "background playback" (the <audio> element itself already keeps
  // playing when the tab is backgrounded; this adds the OS-level UI for it).
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "VisionKids",
      artwork: coverImageUrl ? [{ src: coverImageUrl, sizes: "512x512", type: "image/png" }] : [],
    });
    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(10));
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, coverImageUrl]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    };
  }, []);

  const skip = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + deltaSeconds));
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (audioRef.current) audioRef.current.playbackRate = value;
  };

  const setSleepTimer = (minutes: number | null) => {
    if (sleepTimerRef.current) window.clearTimeout(sleepTimerRef.current);
    setSleepMinutesLeft(minutes);
    if (minutes) {
      sleepTimerRef.current = window.setTimeout(() => {
        audioRef.current?.pause();
        setSleepMinutesLeft(null);
      }, minutes * 60 * 1000);
    }
  };

  const jumpToChapter = (startSeconds: number) => {
    if (audioRef.current) audioRef.current.currentTime = startSeconds;
  };

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.duration;
          setCurrent(e.currentTarget.currentTime);
          if (onProgress) onProgress(e.currentTarget.currentTime, t);
        }}
      />

      <div className="flex items-center gap-3">
        <Button size="icon" className="h-12 w-12 rounded-full bg-kids-primary text-white hover:bg-kids-primary/90" onClick={togglePlay} aria-label={playing ? t("kids.audio.pause") : t("kids.audio.play")}>
          {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => skip(-10)} aria-label={t("kids.audio.skipBack")}>
          <SkipBack className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => skip(10)} aria-label={t("kids.audio.skipForward")}>
          <SkipForward className="h-5 w-5" aria-hidden="true" />
        </Button>

        <div className="flex flex-1 items-center gap-2">
          <span className="w-10 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{formatTime(current)}</span>
          <Slider
            value={[current]}
            max={duration || 1}
            step={1}
            onValueChange={([v]) => { if (audioRef.current) audioRef.current.currentTime = v; }}
            aria-label={t("kids.audio.progress")}
            className="flex-1"
          />
          <span className="w-10 text-xs tabular-nums text-muted-foreground" aria-hidden="true">{formatTime(duration)}</span>
        </div>

        {onBookmark && (
          <Button variant="ghost" size="icon" onClick={() => onBookmark(current)} aria-label={t("kids.audio.addBookmark")}>
            <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1" aria-label={t("kids.audio.speed")}>
              <Gauge className="h-4 w-4" aria-hidden="true" /> {speed}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("kids.audio.speed")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SPEEDS.map((s) => (
              <DropdownMenuItem key={s} onClick={() => changeSpeed(s)} className={speed === s ? "font-semibold text-kids-primary" : ""}>
                {s}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("kids.audio.sleepTimer")}>
              <Timer className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{sleepMinutesLeft ? `${t("kids.audio.sleepTimer")}: ${sleepMinutesLeft}m` : t("kids.audio.sleepTimer")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SLEEP_OPTIONS.map((m) => (
              <DropdownMenuItem key={m} onClick={() => setSleepTimer(m)}>{m} {t("kids.audio.minutes")}</DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setSleepTimer(null)}>{t("kids.audio.sleepOff")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {chapters.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t("kids.audio.chapters")}>
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("kids.audio.chapters")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {chapters.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => jumpToChapter(c.audio_start_seconds ?? 0)}>
                  {c.chapter_number}. {c.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
