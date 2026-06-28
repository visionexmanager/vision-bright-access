"use client";
import { memo, useState, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Play, Heart, Star } from "lucide-react";
import { clsx } from "clsx";
import type { Channel } from "@/lib/api";

interface Props {
  channel:      Channel;
  isFavorite?:  boolean;
  onPlay:       (ch: Channel) => void;
  onFavorite?:  (ch: Channel) => void;
  size?:        "sm" | "md" | "lg";
}

export const ChannelCard = memo(function ChannelCard({
  channel, isFavorite, onPlay, onFavorite, size = "md",
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [hovering, setHovering] = useState(false);

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onPlay(channel);
  }, [onPlay, channel]);

  const handleFav = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFavorite?.(channel);
  }, [onFavorite, channel]);

  const sizes = {
    sm: "w-28 h-20",
    md: "w-40 h-28",
    lg: "w-52 h-36",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={clsx(
        "relative group rounded-xl overflow-hidden bg-vx-card border border-vx-border cursor-pointer shrink-0",
        sizes[size]
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handlePlay}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && handlePlay(e as any)}
      aria-label={`Play ${channel.name}`}
    >
      {/* Logo / thumbnail */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-vx-card">
        {channel.logoUrl && !imgError ? (
          <Image
            src={channel.logoUrl}
            alt={channel.name}
            fill
            className="object-contain p-3"
            unoptimized
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <span className="text-vx-muted text-xs font-medium text-center line-clamp-2 px-2">
              {channel.name}
            </span>
          </div>
        )}
      </div>

      {/* Hover overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: hovering ? 1 : 0 }}
        className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-3"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: hovering ? 1 : 0.8 }}
          className="w-10 h-10 rounded-full bg-vx-accent flex items-center justify-center shadow-lg"
        >
          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
        </motion.div>
        <p className="text-white text-xs font-medium text-center line-clamp-2">{channel.name}</p>
      </motion.div>

      {/* Live badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-vx-live animate-pulse-live" />
        <span className="text-vx-live text-[9px] font-bold uppercase tracking-widest">LIVE</span>
      </div>

      {/* Quality badge */}
      {channel.quality && (
        <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5">
          <span className="text-vx-gold text-[9px] font-bold">{channel.quality}</span>
        </div>
      )}

      {/* Favorite button */}
      {onFavorite && (
        <button
          onClick={handleFav}
          className={clsx(
            "absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all",
            isFavorite
              ? "bg-vx-accent text-white"
              : "bg-black/70 text-vx-muted hover:text-white opacity-0 group-hover:opacity-100"
          )}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={clsx("w-3 h-3", isFavorite && "fill-current")} />
        </button>
      )}

      {/* Featured star */}
      {channel.isFeatured && (
        <div className="absolute bottom-2 left-2">
          <Star className="w-3 h-3 text-vx-gold fill-current" />
        </div>
      )}
    </motion.div>
  );
});
