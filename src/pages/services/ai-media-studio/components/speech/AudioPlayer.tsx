import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Download, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GeneratedAudio } from "@/lib/types/speech-studio";

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

interface Props {
  audio: GeneratedAudio;
  onReset?: () => void;
}

export function AudioPlayer({ audio, onReset }: Props) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]       = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]     = useState(audio.durationSec ?? 0);
  const [dragging, setDragging]     = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay   = () => setPlaying(true);
    const onPause  = () => setPlaying(false);
    const onEnded  = () => { setPlaying(false); setCurrentTime(0); };
    const onTime   = () => { if (!dragging) setCurrentTime(el.currentTime); };
    const onLoaded = () => setDuration(el.duration || audio.durationSec);

    el.addEventListener("play",             onPlay);
    el.addEventListener("pause",            onPause);
    el.addEventListener("ended",            onEnded);
    el.addEventListener("timeupdate",       onTime);
    el.addEventListener("loadedmetadata",   onLoaded);

    return () => {
      el.removeEventListener("play",           onPlay);
      el.removeEventListener("pause",          onPause);
      el.removeEventListener("ended",          onEnded);
      el.removeEventListener("timeupdate",     onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [audio.durationSec, dragging]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play();
  }, [playing]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  }, []);

  const handleDownload = useCallback(() => {
    const a = document.createElement("a");
    a.href = audio.blobUrl;
    a.download = `speech-${audio.jobId.slice(0, 8)}.${audio.outputFormat}`;
    a.click();
  }, [audio]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Hidden HTML audio */}
      <audio ref={audioRef} src={audio.blobUrl} preload="metadata" />

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
          <Volume2 className="h-5 w-5 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{audio.voiceName}</p>
          <p className="text-xs text-muted-foreground truncate">{audio.text.slice(0, 80)}{audio.text.length > 80 ? "…" : ""}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Badge variant="secondary" className="text-[10px] uppercase">{audio.outputFormat}</Badge>
          <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30 bg-green-500/10">
            Ready
          </Badge>
        </div>
      </div>

      {/* Seek bar */}
      <div className="space-y-1">
        <div className="relative h-2 w-full rounded-full bg-muted cursor-pointer group">
          {/* Filled track */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setDragging(true)}
            onMouseUp={()   => setDragging(false)}
            onTouchStart={()=> setDragging(true)}
            onTouchEnd={()  => setDragging(false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Seek audio"
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow transition-all opacity-0 group-hover:opacity-100"
            style={{ left: `calc(${pct}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          className={cn("h-10 w-10 rounded-full", playing && "bg-green-600 hover:bg-green-700")}
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>

        <div className="flex-1 text-xs text-muted-foreground">
          {formatBytes(audio.sizeBytes)} · {formatTime(duration)}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>

        {onReset && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
