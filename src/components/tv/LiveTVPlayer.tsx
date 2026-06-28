import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, Volume2, VolumeX, Maximize, Pause, Play, RotateCcw } from "lucide-react";
import { callTVStreamToken } from "@/lib/api/edgeFunctions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  token: string;          // short-lived stream token
  channelName: string;
  channelLogo?: string | null;
  onError?: (msg: string) => void;
};

type StreamInfo = {
  stream_url: string;
  quality:    string;
  name:       string;
  name_ar:    string;
  logo_url?:  string | null;
  expires_at: string;
};

declare global {
  interface Window {
    Hls: typeof import("hls.js").default;
  }
}

// Dynamically loads hls.js from CDN only when needed (avoids bundle bloat)
async function loadHls(): Promise<typeof import("hls.js").default> {
  if (window.Hls) return window.Hls;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error("Failed to load HLS.js"));
    document.head.appendChild(script);
  });
}

export function LiveTVPlayer({ token, channelName, channelLogo, onError }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<import("hls.js").default | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading,   setLoading]   = useState(true);
  const [errMsg,    setErrMsg]    = useState<string | null>(null);
  const [muted,     setMuted]     = useState(false);
  const [playing,   setPlaying]   = useState(true);
  const [showCtrl,  setShowCtrl]  = useState(true);
  const [retryKey,  setRetryKey]  = useState(0);  // incremented to force re-init
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleError = useCallback(
    (msg: string) => {
      setErrMsg(msg);
      setLoading(false);
      onError?.(msg);
    },
    [onError]
  );

  useEffect(() => {
    let destroyed = false;

    async function init() {
      setLoading(true);
      setErrMsg(null);

      // Exchange token for real stream URL via the tv-stream-token edge function
      let streamInfo: StreamInfo;
      try {
        streamInfo = await callTVStreamToken(token) as unknown as StreamInfo;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        handleError(
          msg === "subscription_expired"
            ? "انتهى اشتراكك، يرجى التجديد"
            : "تعذر تحميل البث"
        );
        return;
      }

      if (destroyed || !videoRef.current) return;

      const video = videoRef.current;
      const url   = streamInfo.stream_url;

      // Native HLS (Safari / iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.play().catch(() => {});
        setLoading(false);
        return;
      }

      // hls.js for Chrome / Firefox
      try {
        const Hls = await loadHls();
        if (!Hls.isSupported()) {
          handleError("المتصفح لا يدعم بث HLS");
          return;
        }
        if (destroyed) return;

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });
        hlsRef.current = hls;

        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!destroyed) { video.play().catch(() => {}); setLoading(false); }
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) handleError("انقطع البث، يرجى إعادة المحاولة");
        });
      } catch (e) {
        handleError("فشل تهيئة مشغل الفيديو");
      }
    }

    init();

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [token, retryKey, handleError]); // retryKey increments to force re-init on manual retry

  // Auto-hide controls
  const resetHideTimer = () => {
    setShowCtrl(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3000);
  };

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const retry = () => { setErrMsg(null); setLoading(true); setRetryKey(k => k + 1); };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group select-none"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
      />

      {/* Loading spinner */}
      {loading && !errMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-3">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          <p className="text-white text-sm">جاري تحميل البث…</p>
        </div>
      )}

      {/* Error state */}
      {errMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" aria-hidden="true" />
          <p className="text-white font-medium text-lg">{errMsg}</p>
          <Button variant="outline" size="sm" onClick={retry} className="gap-2 text-white border-white/30 hover:bg-white/10">
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> إعادة المحاولة
          </Button>
        </div>
      )}

      {/* Channel watermark */}
      {channelLogo && (
        <div className="absolute top-3 right-3 pointer-events-none">
          <img src={channelLogo} alt={channelName} className="h-8 w-auto opacity-80 drop-shadow-lg" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3 pt-8 flex items-end gap-3 transition-opacity duration-300",
          showCtrl ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          className="text-white hover:bg-white/20 h-9 w-9"
          aria-label={playing ? "Pause live stream" : "Play live stream"}
          aria-pressed={playing}
        >
          {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5" aria-hidden="true" />}
        </Button>

        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="text-white hover:bg-white/20 h-9 w-9"
          aria-label={muted ? "Unmute live stream" : "Mute live stream"}
          aria-pressed={muted}
        >
          {muted ? <VolumeX className="w-5 h-5" aria-hidden="true" /> : <Volume2 className="w-5 h-5" aria-hidden="true" />}
        </Button>

        <span className="text-white text-sm font-medium flex-1 truncate pr-2 drop-shadow">{channelName}</span>

        <Button
          size="icon"
          variant="ghost"
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/20 h-9 w-9"
          aria-label="Open fullscreen"
        >
          <Maximize className="w-5 h-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
