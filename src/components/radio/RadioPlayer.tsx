import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, AlertCircle, Volume2, VolumeX, Pause, Play, RotateCcw, Radio, Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  token:       string;
  stationName: string;
  stationLogo?: string | null;
  onError?:    (msg: string) => void;
};

type StreamInfo = {
  stream_url: string;
  bitrate:    string;
  name_ar:    string;
};

declare global {
  interface Window {
    Hls: typeof import("hls.js").default;
  }
}

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

function isHlsUrl(url: string): boolean {
  return url.includes(".m3u8") || url.includes("hls") || url.includes("manifest");
}

export function RadioPlayer({ token, stationName, stationLogo, onError }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef   = useRef<import("hls.js").default | null>(null);

  const [loading,  setLoading]  = useState(true);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [playing,  setPlaying]  = useState(false);
  const [muted,    setMuted]    = useState(false);
  const [volume,   setVolume]   = useState(80);
  const [bitrate,  setBitrate]  = useState<string | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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
      setPlaying(false);

      // Exchange token for real stream URL via edge function
      let streamInfo: StreamInfo;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/radio-stream-token`, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
            "apikey":        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          handleError(
            json.error === "subscription_expired"
              ? "انتهى اشتراكك، يرجى التجديد"
              : "تعذر تحميل البث"
          );
          return;
        }
        streamInfo = json as StreamInfo;
      } catch {
        handleError("لا يمكن الاتصال بالخادم");
        return;
      }

      if (destroyed || !audioRef.current) return;

      setBitrate(streamInfo.bitrate);
      const audio = audioRef.current;
      const url   = streamInfo.stream_url;

      // Apply volume state
      audio.volume = volume / 100;
      audio.muted  = muted;

      if (isHlsUrl(url)) {
        // HLS audio stream (radio via .m3u8)
        if (audio.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS (Safari)
          audio.src = url;
          audio.play().then(() => { if (!destroyed) { setPlaying(true); setLoading(false); } }).catch(() => {});
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

          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed) {
              audio.play().then(() => { setPlaying(true); setLoading(false); }).catch(() => { setLoading(false); });
            }
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) handleError("انقطع البث، يرجى إعادة المحاولة");
          });
        } catch {
          handleError("فشل تهيئة مشغل الصوت");
        }
      } else {
        // Direct MP3 / AAC stream
        audio.src = url;
        audio.play()
          .then(() => { if (!destroyed) { setPlaying(true); setLoading(false); } })
          .catch(() => { if (!destroyed) { setLoading(false); } });
      }
    }

    init();

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, SUPABASE_URL, handleError]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else          { a.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  };

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
      if (v === 0) { audioRef.current.muted = true; setMuted(true); }
      else if (muted) { audioRef.current.muted = false; setMuted(false); }
    }
  };

  const retry = () => { setErrMsg(null); setLoading(true); };

  return (
    <div className="w-full rounded-2xl border border-border bg-card overflow-hidden">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onError={() => handleError("خطأ في تشغيل البث")}
      />

      {/* Station identity bar */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border bg-gradient-to-l from-orange-500/5 via-transparent to-transparent">
        <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-muted flex items-center justify-center shadow">
          {stationLogo ? (
            <img src={stationLogo} alt={stationName} className="w-full h-full object-cover" />
          ) : (
            <Radio className="w-7 h-7 text-orange-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base truncate text-foreground">{stationName}</p>
          <div className="flex items-center gap-2 mt-1">
            {playing && !errMsg && (
              <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                بث مباشر
              </span>
            )}
            {bitrate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                {bitrate} kbps
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player controls */}
      <div className="px-5 py-4 space-y-4">

        {/* Loading / Error state */}
        {loading && !errMsg && (
          <div className="flex items-center justify-center gap-3 py-4 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            <span className="text-sm">جاري الاتصال بالمحطة…</span>
          </div>
        )}

        {errMsg && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm font-medium text-foreground">{errMsg}</p>
            <Button variant="outline" size="sm" onClick={retry} className="gap-2">
              <RotateCcw className="w-4 h-4" /> إعادة المحاولة
            </Button>
          </div>
        )}

        {/* Controls row */}
        {!errMsg && (
          <div className="flex items-center gap-4">
            {/* Play / Pause */}
            <Button
              size="icon"
              onClick={togglePlay}
              disabled={loading}
              className={cn(
                "w-12 h-12 rounded-full flex-shrink-0 shadow-md transition-all",
                playing
                  ? "bg-orange-500 hover:bg-orange-400 text-white"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              )}
            >
              {loading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : playing
                ? <Pause className="w-5 h-5 fill-white" />
                : <Play className="w-5 h-5" />
              }
            </Button>

            {/* Volume section */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMute}
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
              >
                {muted || volume === 0
                  ? <VolumeX className="w-4 h-4" />
                  : <Volume2 className="w-4 h-4" />
                }
              </Button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={muted ? 0 : volume}
                onChange={e => handleVolumeChange([Number(e.target.value)])}
                className="flex-1 h-1.5 accent-orange-500 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground w-7 text-left flex-shrink-0">
                {muted ? "0" : volume}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
