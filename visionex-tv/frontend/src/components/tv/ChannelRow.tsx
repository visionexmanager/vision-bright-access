"use client";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ChannelCard } from "./ChannelCard";
import { SkeletonRow } from "./SkeletonCard";
import type { Channel } from "@/lib/api";

interface Props {
  title:        string;
  channels:     Channel[];
  loading?:     boolean;
  favoriteIds?: Set<string>;
  onPlay:       (ch: Channel) => void;
  onFavorite?:  (ch: Channel) => void;
  size?:        "sm" | "md" | "lg";
}

export function ChannelRow({
  title, channels, loading, favoriteIds, onPlay, onFavorite, size = "md",
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -320 : 320, behavior: "smooth" });
  };

  if (loading) {
    return (
      <section className="mb-8">
        <div className="w-40 h-6 skeleton rounded mb-4" />
        <SkeletonRow count={6} />
      </section>
    );
  }

  if (!channels.length) return null;

  return (
    <section className="mb-8 group/row">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-xl font-bold">{title}</h2>
        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <button
            onClick={() => scroll("left")}
            className="w-8 h-8 rounded-full bg-vx-card border border-vx-border flex items-center justify-center text-vx-muted hover:text-white hover:border-white transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-8 h-8 rounded-full bg-vx-card border border-vx-border flex items-center justify-center text-vx-muted hover:text-white hover:border-white transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-2"
      >
        {channels.map(ch => (
          <ChannelCard
            key={ch.id}
            channel={ch}
            isFavorite={favoriteIds?.has(ch.id)}
            onPlay={onPlay}
            onFavorite={onFavorite}
            size={size}
          />
        ))}
      </div>
    </section>
  );
}
