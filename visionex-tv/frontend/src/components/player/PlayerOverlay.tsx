"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, WifiOff, RefreshCw } from "lucide-react";
import Image from "next/image";

interface Props {
  buffering:   boolean;
  error:       string | null;
  channelName: string;
  logo?:       string | null;
  onRetry:     () => void;
}

export function PlayerOverlay({ buffering, error, channelName, logo, onRetry }: Props) {
  if (!buffering && !error) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10"
      >
        {/* Logo */}
        {logo && (
          <div className="w-16 h-16 mb-6 relative">
            <Image
              src={logo}
              alt={channelName}
              fill
              className="object-contain drop-shadow-lg"
              unoptimized
            />
          </div>
        )}

        {error ? (
          <>
            <WifiOff className="w-10 h-10 text-vx-accent mb-3" />
            <p className="text-white text-lg font-medium mb-1">{channelName}</p>
            <p className="text-vx-muted text-sm mb-6">Stream unavailable — switching source…</p>
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-vx-accent hover:bg-vx-accent-hover rounded-lg text-white text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
            <p className="text-white text-base font-medium">{channelName}</p>
            <p className="text-vx-muted text-sm mt-1">Loading stream…</p>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
