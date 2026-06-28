import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play, Pause, Volume2, VolumeX,
  Maximize2, Download, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface VideoPlayerProps {
  src:          string;
  thumbnail?:   string | null;
  title?:       string | null;
  className?:   string;
  showDownload?: boolean;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src, thumbnail, title, className, showDownload }: VideoPlayerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [muted,   setMuted]     = useState(false);
  const [volume,  setVolume]    = useState(1);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading]   = useState(true);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play();  setPlaying(true);  }
    else          { v.pause(); setPlaying(false); }
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrent(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setLoading(false);
    }
  };

  const seek = (val: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = val[0];
      setCurrent(val[0]);
    }
  };

  const changeVolume = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    setMuted(v === 0);
    if (videoRef.current) videoRef.current.volume = v;
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  const fullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const restart = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setPlaying(true);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href     = src;
    a.download = title ?? "video.mp4";
    a.click();
  };

  return (
    <div className={cn("group relative overflow-hidden rounded-xl bg-black", className)}>
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail ?? undefined}
        className="w-full aspect-video object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onClick={togglePlay}
        preload="metadata"
      />

      {/* Loading spinner overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {/* Controls overlay */}
      <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-6 transition-transform duration-200 group-hover:translate-y-0">
        {/* Seek bar */}
        <Slider
          value={[current]}
          max={duration || 100}
          step={0.1}
          onValueChange={seek}
          className="mb-2 h-1"
        />

        {/* Bottom controls */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="size-7 text-white" onClick={togglePlay}>
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>

          <Button size="icon" variant="ghost" className="size-7 text-white" onClick={restart}>
            <RotateCcw className="size-3.5" />
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-7 text-white" onClick={toggleMute}>
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </Button>
            <Slider
              value={[muted ? 0 : volume]}
              max={1}
              step={0.05}
              onValueChange={changeVolume}
              className="w-16 h-1"
            />
          </div>

          {/* Time */}
          <span className="ml-1 text-[10px] text-white/70">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {showDownload && (
              <Button size="icon" variant="ghost" className="size-7 text-white" onClick={download}>
                <Download className="size-3.5" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="size-7 text-white" onClick={fullscreen}>
              <Maximize2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
