"use client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  PictureInPicture, PictureInPicture2,
} from "lucide-react";
import Image from "next/image";

interface Props {
  visible:     boolean;
  playing:     boolean;
  buffering:   boolean;
  volume:      number;
  muted:       boolean;
  pipActive:   boolean;
  fsActive:    boolean;
  channelName: string;
  logo?:       string | null;
  onPlayPause: () => void;
  onVolume:    (v: number) => void;
  onMute:      () => void;
  onPip:       () => void;
  onFullscreen: () => void;
}

export function PlayerControls({
  visible, playing, buffering, volume, muted,
  pipActive, fsActive, channelName, logo,
  onPlayPause, onVolume, onMute, onPip, onFullscreen,
}: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex flex-col justify-between z-20 pointer-events-none"
        >
          {/* Top bar — channel info */}
          <div className="flex items-center gap-3 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
            {logo && (
              <div className="w-8 h-8 relative shrink-0">
                <Image src={logo} alt={channelName} fill className="object-contain" unoptimized />
              </div>
            )}
            <span className="text-white font-semibold text-shadow truncate">{channelName}</span>
            <span className="live-dot ml-2 text-vx-live text-xs font-bold uppercase tracking-wider">LIVE</span>
          </div>

          {/* Center — play/pause click target */}
          <div
            className="flex-1 flex items-center justify-center cursor-pointer pointer-events-auto"
            onClick={onPlayPause}
          />

          {/* Bottom bar — controls */}
          <div className="p-4 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button
                onClick={onPlayPause}
                className="text-white hover:text-vx-accent transition-colors"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing
                  ? <Pause className="w-6 h-6 fill-current" />
                  : <Play  className="w-6 h-6 fill-current" />
                }
              </button>

              {/* Volume */}
              <button onClick={onMute} className="text-white hover:text-vx-accent transition-colors">
                {muted || volume === 0
                  ? <VolumeX className="w-5 h-5" />
                  : <Volume2 className="w-5 h-5" />
                }
              </button>
              <input
                type="range"
                min={0} max={100}
                value={muted ? 0 : volume}
                onChange={e => onVolume(Number(e.target.value))}
                className="w-20 h-1 appearance-none bg-white/30 rounded-full cursor-pointer accent-white"
              />

              {/* Spacer */}
              <div className="flex-1" />

              {/* PiP */}
              <button onClick={onPip} className="text-white hover:text-vx-accent transition-colors" aria-label="Picture in Picture">
                {pipActive
                  ? <PictureInPicture2 className="w-5 h-5" />
                  : <PictureInPicture  className="w-5 h-5" />
                }
              </button>

              {/* Fullscreen */}
              <button onClick={onFullscreen} className="text-white hover:text-vx-accent transition-colors" aria-label="Fullscreen">
                {fsActive
                  ? <Minimize  className="w-5 h-5" />
                  : <Maximize  className="w-5 h-5" />
                }
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
