/**
 * OfficialStreamPlayer
 * Plays any official public source:
 *   • youtube.com/embed URL  → <iframe>
 *   • HLS .m3u8 URL          → <video> + hls.js
 *   • Direct audio URL       → <audio> element
 *   • Other URL              → external-link button
 *
 * All UI text is fully localised via useLanguage / t().
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Volume2, VolumeX, Maximize,
  Pause, Play, RotateCcw, ExternalLink, Radio, Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

declare global {
  interface Window { Hls: typeof import("hls.js").default; }
}

async function loadHls() {
  if (window.Hls) return window.Hls;
  return new Promise<typeof import("hls.js").default>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error("hls.js load failed"));
    document.head.appendChild(s);
  });
}

export type UrlType = "youtube" | "hls" | "audio" | "external";

export function detectType(url: string): UrlType {
  if (!url) return "external";
  if (url.includes("youtube.com/embed") || url.includes("youtu.be")) return "youtube";
  // Audio-specific keywords checked BEFORE generic HLS so radio streams
  // don't accidentally go to the video HLS player.
  if (
    url.match(/\.(mp3|aac|ogg|opus|flac|wav)(\?|$)/i) ||
    url.includes("icecast") || url.includes("shoutcast") ||
    url.includes("radiojar") || url.includes("zeno.fm") ||
    url.includes("infomaniak") || url.includes("bbcmedia") ||
    url.includes("zenapi") || url.includes("lstn.lv") ||
    url.includes("streamtheworld") || url.includes("sslstream") ||
    url.includes("stream.srg-ssr")
  ) return "audio";
  if (url.match(/\.(m3u8)(\?|$)/i) || url.includes("hls")) return "hls";
  return "external";
}

interface Props {
  url:      string;
  name:     string;
  logo?:    string | null;
  isTV?:    boolean;
  onError?: () => void;
}

// ── YouTube iframe ──────────────────────────────────────────────
function YouTubePlayer({ url, name, t }: { url: string; name: string; t: (k: string) => string }) {
  const [loading, setLoading] = useState(true);

  // Timeout: hide loading overlay after 12s even if onLoad hasn't fired
  useEffect(() => {
    setLoading(true);
    const tid = setTimeout(() => setLoading(false), 12_000);
    return () => clearTimeout(tid);
  }, [url]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60 z-10">
          <Loader2 className="w-10 h-10 animate-spin text-red-500" />
          <p className="text-sm">{t("player.loading")}</p>
        </div>
      )}
      <iframe
        src={url}
        title={name}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={() => setLoading(false)}
      />
      <div className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/70 pointer-events-none select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {t("player.officialSrc")}
      </div>
    </div>
  );
}

// ── HLS video ───────────────────────────────────────────────────
function HLSPlayer({
  url, name, logo, t, onError,
}: { url: string; name: string; logo?: string | null; t: (k: string) => string; onError?: () => void }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const hlsRef       = useRef<import("hls.js").default | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading,  setLoading]  = useState(true);
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [muted,    setMuted]    = useState(false);
  const [playing,  setPlaying]  = useState(true);
  const [showCtrl, setShowCtrl] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const err = useCallback((msg: string) => { setErrMsg(msg); setLoading(false); onError?.(); }, [onError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true); setErrMsg(null);

    (async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          video.play().catch(() => {});
          video.oncanplay = () => { setLoading(false); setPlaying(true); };
          video.onerror = () => err(t("player.errPlay"));
        } else {
          const Hls = await loadHls();
          if (!Hls.isSupported()) { err(t("player.noHls")); return; }
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
            setLoading(false);
            setPlaying(true);
          });
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) err(t("player.errPlay")); });
        }
      } catch { err(t("player.errLoad")); }
    })();

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const showControls = () => {
    setShowCtrl(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 3000);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group cursor-pointer"
      onMouseMove={showControls} onTouchStart={showControls}
    >
      <video ref={videoRef} className="w-full h-full object-contain" muted={muted} playsInline />

      {loading && !errMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
          <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
          <p className="text-sm text-white/60">{t("player.loading")}</p>
        </div>
      )}
      {errMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 z-10">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-white/70">{errMsg}</p>
          <Button size="sm" variant="outline" className="text-white border-white/20 hover:bg-white/10"
            onClick={() => { setErrMsg(null); setLoading(true); }}>
            <RotateCcw className="w-3.5 h-3.5 me-1.5" /> {t("player.retry")}
          </Button>
        </div>
      )}

      {!loading && !errMsg && (
        <div className={cn(
          "absolute inset-0 flex flex-col justify-between p-3 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300",
          showCtrl ? "opacity-100" : "opacity-0"
        )}>
          <div className="flex items-center gap-2">
            {logo && <img src={logo} alt={name} className="h-7 w-7 rounded object-contain bg-white/10 p-0.5" />}
            <span className="text-sm font-semibold text-white drop-shadow">{name}</span>
            <span className="ms-auto flex items-center gap-1 text-[10px] text-white/70 bg-black/40 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {t("player.live")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play(); setPlaying(!playing); }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={() => { setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => containerRef.current?.requestFullscreen?.()}
              className="ms-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 start-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/70 pointer-events-none select-none z-20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        {t("player.officialSrc")}
      </div>
    </div>
  );
}

// ── Audio player ────────────────────────────────────────────────
function AudioPlayer({
  url, name, logo, t, onError,
}: { url: string; name: string; logo?: string | null; t: (k: string) => string; onError?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef   = useRef<import("hls.js").default | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [volume,  setVolume]  = useState(80);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);

  const err = useCallback((msg: string) => { setErrMsg(msg); setLoading(false); onError?.(); }, [onError]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setLoading(true); setErrMsg(null); setPlaying(false);
    audio.volume = volume / 100;

    const isHls = url.includes(".m3u8") || url.includes("hls");

    if (isHls) {
      (async () => {
        try {
          const Hls = await loadHls();
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            audio.play()
              .then(() => { setLoading(false); setPlaying(true); })
              .catch(() => { setLoading(false); });
          });
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) err(t("player.errConnect")); });
        } catch { err(t("player.errLoad")); }
      })();
    } else {
      audio.src = url;
      audio.oncanplay = () => {
        audio.play()
          .then(() => { setLoading(false); setPlaying(true); })
          .catch(() => setLoading(false));
      };
      audio.onerror = () => err(t("player.errConnect"));
    }

    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-orange-950/60 to-slate-900 p-6 space-y-5">
      <audio ref={audioRef} preload="none" />
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10",
          playing ? "bg-orange-500/20" : "bg-white/5"
        )}>
          {logo
            ? <img src={logo} alt={name} className="w-full h-full object-contain rounded-2xl p-1" />
            : <Radio className={cn("w-10 h-10", playing ? "text-orange-400" : "text-white/30")} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-white truncate">{name}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", playing ? "bg-orange-400 animate-pulse" : "bg-white/20")} />
            <span className="text-sm text-white/60">
              {playing ? t("player.onAir") : loading ? t("player.loading") : t("player.paused")}
            </span>
          </div>
        </div>
      </div>

      {playing && (
        <div className="flex items-end justify-center gap-0.5 h-8">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-1 bg-orange-400/80 rounded-full animate-pulse"
              style={{ height: `${20 + Math.sin(i * 0.8) * 12}px`, animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      )}

      {errMsg && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errMsg}</span>
          <Button size="sm" variant="ghost" className="ms-auto text-white/60 hover:text-white"
            onClick={() => { setErrMsg(null); setLoading(true); }}>
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={loading && !errMsg}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-all flex-shrink-0",
            loading && !errMsg
              ? "bg-white/10 text-white/30 cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30"
          )}>
          {loading && !errMsg
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ms-0.5" />
          }
        </button>
        <button
          onClick={() => { setMuted(!muted); if (audioRef.current) audioRef.current.muted = !muted; }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range" min={0} max={100} value={muted ? 0 : volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            if (audioRef.current) { audioRef.current.volume = v / 100; setMuted(v === 0); }
          }}
          className="flex-1 h-1.5 appearance-none bg-white/20 rounded-full accent-orange-400 cursor-pointer"
        />
      </div>

      <p className="text-center text-[10px] text-white/30 flex items-center justify-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        {t("player.officialSrc")}
      </p>
    </div>
  );
}

// ── External link fallback ──────────────────────────────────────
function ExternalPlayer({ url, name, isTV, t }: { url: string; name: string; isTV?: boolean; t: (k: string) => string }) {
  return (
    <div className={cn(
      "rounded-2xl border flex flex-col items-center justify-center gap-4 p-10 text-center",
      isTV ? "aspect-video bg-slate-900" : "bg-card"
    )}>
      {isTV ? <Tv className="w-16 h-16 text-blue-400/40" /> : <Radio className="w-14 h-14 text-orange-400/40" />}
      <div>
        <p className="font-semibold text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground mt-1">{t("player.externalDesc")}</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button className={isTV ? "bg-blue-600 hover:bg-blue-500" : "bg-orange-500 hover:bg-orange-400"}>
          <ExternalLink className="w-4 h-4 me-2" />
          {t("player.openSource")}
        </Button>
      </a>
      <p className="text-[10px] text-muted-foreground/60">{t("player.newTab")}</p>
    </div>
  );
}

// ── No-source placeholder ───────────────────────────────────────
function NoSourcePlayer({ isTV, t }: { isTV?: boolean; t: (k: string) => string }) {
  return (
    <div className={cn(
      "rounded-xl border flex items-center justify-center text-muted-foreground",
      isTV ? "aspect-video bg-muted" : "p-12 bg-card"
    )}>
      <div className="flex flex-col items-center gap-2">
        {isTV ? <Tv className="w-14 h-14 opacity-20" /> : <Radio className="w-12 h-12 opacity-20" />}
        <p className="text-sm">{t("player.noSource")}</p>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────
export function OfficialStreamPlayer({ url, name, logo, isTV = false, onError }: Props) {
  const { t } = useLanguage();

  if (!url) return <NoSourcePlayer isTV={isTV} t={t} />;

  const type = detectType(url);

  if (type === "youtube") return <YouTubePlayer url={url} name={name} t={t} />;
  // HLS radio streams (isTV=false) → AudioPlayer UI; TV HLS → video HLSPlayer
  if (type === "hls" && isTV)  return <HLSPlayer   url={url} name={name} logo={logo} t={t} onError={onError} />;
  if (type === "hls" && !isTV) return <AudioPlayer url={url} name={name} logo={logo} t={t} onError={onError} />;
  if (type === "audio")        return <AudioPlayer url={url} name={name} logo={logo} t={t} onError={onError} />;
  return <ExternalPlayer url={url} name={name} isTV={isTV} t={t} />;
}
