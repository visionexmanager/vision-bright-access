"use client";

/**
 * VideoPlayer — production HLS.js player with:
 *  • HLS / DASH / MP4 source support
 *  • Auto-quality switching (ABR)
 *  • Instant channel switching (destroys and recreates HLS instance)
 *  • Automatic failover via WebSocket
 *  • Picture-in-Picture
 *  • Fullscreen
 *  • Custom controls (hide on idle)
 *  • Buffer health reporting every 5s
 */

import {
  useRef, useEffect, useCallback, useState,
  useReducer, memo,
} from "react";
import Hls from "hls.js";
import { usePlayerStore }    from "@/store/player.store";
import { useAuthStore }      from "@/store/auth.store";
import { stream as streamApi, emitPlaybackStat } from "@/lib/api";
import { emitStreamError }   from "@/lib/websocket";
import { PlayerControls }    from "./PlayerControls";
import { PlayerOverlay }     from "./PlayerOverlay";
import { clsx }              from "clsx";

interface Props {
  url:       string;
  type:      "hls" | "dash" | "mp4";
  sourceId:  string;
  channelId: string;
  channelName: string;
  logo?:     string | null;
  onSwitch?: (newUrl: string, newSourceId: string) => void;
}

type State = {
  playing:    boolean;
  buffering:  boolean;
  error:      string | null;
  showControls: boolean;
  pipActive:  boolean;
  fsActive:   boolean;
  duration:   number;
  currentTime: number;
};
type Action =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "BUFFER_START" }
  | { type: "BUFFER_END" }
  | { type: "ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SHOW_CONTROLS" }
  | { type: "HIDE_CONTROLS" }
  | { type: "PIP"; payload: boolean }
  | { type: "FS"; payload: boolean }
  | { type: "TIME"; payload: { current: number; duration: number } };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "PLAY":          return { ...s, playing: true, buffering: false, error: null };
    case "PAUSE":         return { ...s, playing: false };
    case "BUFFER_START":  return { ...s, buffering: true };
    case "BUFFER_END":    return { ...s, buffering: false };
    case "ERROR":         return { ...s, error: a.payload, buffering: false };
    case "CLEAR_ERROR":   return { ...s, error: null };
    case "SHOW_CONTROLS": return { ...s, showControls: true };
    case "HIDE_CONTROLS": return { ...s, showControls: false };
    case "PIP":           return { ...s, pipActive: a.payload };
    case "FS":            return { ...s, fsActive: a.payload };
    case "TIME":          return { ...s, currentTime: a.payload.current, duration: a.payload.duration };
    default:              return s;
  }
}

const INITIAL: State = {
  playing: false, buffering: true, error: null,
  showControls: true, pipActive: false, fsActive: false,
  duration: 0, currentTime: 0,
};

export const VideoPlayer = memo(function VideoPlayer({
  url, type, sourceId, channelId, channelName, logo, onSwitch,
}: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);
  const hlsRef      = useRef<Hls | null>(null);
  const controlsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchStartRef = useRef<number>(Date.now());
  const mediaRecoveredRef = useRef(false);
  const failoverInFlight  = useRef(false);

  const [state, dispatch] = useReducer(reducer, INITIAL);

  const accessToken = useAuthStore(s => s.accessToken);
  const session     = usePlayerStore(s => s.session);
  const { volume, muted, setVolume, setMuted } = usePlayerStore();

  // ── HLS setup ─────────────────────────────────────────────────────────────
  const initHls = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tear down previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    mediaRecoveredRef.current = false;
    dispatch({ type: "CLEAR_ERROR" });
    dispatch({ type: "BUFFER_START" });

    if (type !== "hls" && !url.includes(".m3u8")) {
      // Native MP4 or DASH
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker:         true,
        lowLatencyMode:       true,
        backBufferLength:     30,
        maxBufferLength:      60,
        maxMaxBufferLength:   600,
        maxBufferSize:        60 * 1000 * 1000,
        startLevel:           -1,  // auto ABR
        fragLoadingTimeOut:   10_000,
        manifestLoadingTimeOut: 10_000,
        levelLoadingTimeOut:  10_000,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        dispatch({ type: "BUFFER_END" });
      });

      hls.on(Hls.Events.ERROR, async (_evt, data) => {
        if (!data.fatal) return;

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveredRef.current) {
          mediaRecoveredRef.current = true;
          hls.recoverMediaError();
          return;
        }

        // Fatal error → attempt failover
        dispatch({ type: "ERROR", payload: "Stream interrupted" });
        triggerFailover(sourceId);
      });

      hlsRef.current = hls;

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = url;
      video.play().catch(() => {});
    }
  }, [url, type, sourceId]);

  // ── Failover logic ────────────────────────────────────────────────────────
  const triggerFailover = useCallback(async (failedSourceId: string) => {
    if (failoverInFlight.current || !session || !accessToken) return;
    failoverInFlight.current = true;

    // Signal backend + WebSocket
    emitStreamError(session.token, failedSourceId);
    try {
      const result = await streamApi.switch(session.token, failedSourceId, accessToken);
      if (result && onSwitch) {
        onSwitch(result.url, result.sourceId);
      }
    } catch {
      dispatch({ type: "ERROR", payload: "No streams available" });
    } finally {
      failoverInFlight.current = false;
    }
  }, [session, accessToken, onSwitch]);

  // ── Native video events ───────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay     = () => dispatch({ type: "PLAY" });
    const onPause    = () => dispatch({ type: "PAUSE" });
    const onWaiting  = () => dispatch({ type: "BUFFER_START" });
    const onCanPlay  = () => dispatch({ type: "BUFFER_END" });
    const onTime     = () => dispatch({ type: "TIME", payload: { current: video.currentTime, duration: video.duration || 0 } });
    const onError    = () => triggerFailover(sourceId);
    const onPipEnter = () => dispatch({ type: "PIP", payload: true });
    const onPipLeave = () => dispatch({ type: "PIP", payload: false });

    video.addEventListener("play",                  onPlay);
    video.addEventListener("pause",                 onPause);
    video.addEventListener("waiting",               onWaiting);
    video.addEventListener("canplay",               onCanPlay);
    video.addEventListener("timeupdate",            onTime);
    video.addEventListener("error",                 onError);
    video.addEventListener("enterpictureinpicture", onPipEnter);
    video.addEventListener("leavepictureinpicture", onPipLeave);

    return () => {
      video.removeEventListener("play",                  onPlay);
      video.removeEventListener("pause",                 onPause);
      video.removeEventListener("waiting",               onWaiting);
      video.removeEventListener("canplay",               onCanPlay);
      video.removeEventListener("timeupdate",            onTime);
      video.removeEventListener("error",                 onError);
      video.removeEventListener("enterpictureinpicture", onPipEnter);
      video.removeEventListener("leavepictureinpicture", onPipLeave);
    };
  }, [sourceId, triggerFailover]);

  // ── Re-init when URL changes ──────────────────────────────────────────────
  useEffect(() => {
    watchStartRef.current = Date.now();
    initHls();
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [url, initHls]);

  // ── Volume sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume / 100;
    video.muted  = muted;
  }, [volume, muted]);

  // ── Heartbeat + health reporting ──────────────────────────────────────────
  useEffect(() => {
    if (!session || !accessToken) return;
    heartbeatRef.current = setInterval(() => {
      const video   = videoRef.current;
      const buffered = video?.buffered.length
        ? video.buffered.end(video.buffered.length - 1) - (video.currentTime)
        : 0;
      const health  = Math.min(100, Math.round((buffered / 10) * 100));

      streamApi.heartbeat(session.token, health, accessToken);
      if (session.sourceId) {
        emitPlaybackStat(session.sourceId, 0, buffered < 1 ? 0.1 : 0);
      }
    }, 5_000);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Report watch time on unmount
      const watched = Math.floor((Date.now() - watchStartRef.current) / 1000);
      if (watched > 5) streamApi.stop(session.token, watched, accessToken);
    };
  }, [session, accessToken]);

  // ── Auto-hide controls ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    dispatch({ type: "SHOW_CONTROLS" });
    if (controlsRef.current) clearTimeout(controlsRef.current);
    controlsRef.current = setTimeout(() => dispatch({ type: "HIDE_CONTROLS" }), 3500);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () =>
      dispatch({ type: "FS", payload: !!document.fullscreenElement });
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Picture in Picture ────────────────────────────────────────────────────
  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else                                  await video.requestPictureInPicture();
    } catch {}
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.code) {
        case "Space":  e.preventDefault(); video.paused ? video.play() : video.pause(); break;
        case "KeyF":   toggleFullscreen(); break;
        case "KeyP":   togglePip(); break;
        case "ArrowUp":   e.preventDefault(); setVolume(Math.min(100, volume + 10)); break;
        case "ArrowDown": e.preventDefault(); setVolume(Math.max(0,   volume - 10)); break;
        case "KeyM":   setMuted(!muted); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [volume, muted, toggleFullscreen, togglePip, setVolume, setMuted]);

  return (
    <div
      ref={wrapRef}
      className={clsx(
        "relative w-full bg-black select-none group",
        state.fsActive ? "fixed inset-0 z-50" : "aspect-video rounded-xl overflow-hidden"
      )}
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={showControls}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Overlay: buffering / error */}
      <PlayerOverlay
        buffering={state.buffering}
        error={state.error}
        channelName={channelName}
        logo={logo}
        onRetry={initHls}
      />

      {/* Controls */}
      <PlayerControls
        visible={state.showControls || !state.playing}
        playing={state.playing}
        buffering={state.buffering}
        volume={volume}
        muted={muted}
        pipActive={state.pipActive}
        fsActive={state.fsActive}
        channelName={channelName}
        logo={logo}
        onPlayPause={() => {
          const v = videoRef.current;
          if (!v) return;
          v.paused ? v.play() : v.pause();
        }}
        onVolume={setVolume}
        onMute={() => setMuted(!muted)}
        onPip={togglePip}
        onFullscreen={toggleFullscreen}
      />
    </div>
  );
});

// Re-export for use in emitPlaybackStat
import { emitPlaybackStat as _emit } from "@/lib/websocket";
const emitPlaybackStat_fn = _emit;
export { emitPlaybackStat_fn as emitPlaybackStat };
