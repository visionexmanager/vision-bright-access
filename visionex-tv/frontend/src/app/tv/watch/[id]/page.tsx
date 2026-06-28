"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter }     from "next/navigation";
import { useQuery }      from "@tanstack/react-query";
import { motion }        from "framer-motion";
import {
  ArrowLeft, Heart, Share2, Info, ChevronRight,
} from "lucide-react";
import Link              from "next/link";
import Image             from "next/image";
import { channels, stream as streamApi, favorites } from "@/lib/api";
import type { Channel, StreamSession } from "@/lib/api";
import { useAuthStore }  from "@/store/auth.store";
import { usePlayerStore } from "@/store/player.store";
import { useTvWebSocket } from "@/hooks/useWebSocket";
import { VideoPlayer }   from "@/components/player/VideoPlayer";
import { ChannelRow }    from "@/components/tv/ChannelRow";
import { SkeletonCard }  from "@/components/tv/SkeletonCard";
import { clsx }          from "clsx";

interface Props { params: Promise<{ id: string }> }

export default function WatchPage({ params }: Props) {
  const { id }      = use(params);
  const router      = useRouter();
  const accessToken = useAuthStore(s => s.accessToken);
  const {
    session, setChannel, setSession, setStatus,
    addToRecent, recentIds,
  } = usePlayerStore();

  const [currentUrl,      setCurrentUrl]      = useState<string | null>(null);
  const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
  const [isFavorite,      setIsFavorite]       = useState(false);
  const [sessionError,    setSessionError]     = useState<string | null>(null);

  // Wire up WebSocket real-time events
  useTvWebSocket();

  // ── Fetch channel ─────────────────────────────────────────────────────────
  const { data: channel, isLoading } = useQuery<Channel>({
    queryKey: ["channel", id],
    queryFn:  () => channels.get(id),
    enabled:  !!id,
  });

  // ── Fetch related channels (same category) ────────────────────────────────
  const { data: related } = useQuery({
    queryKey: ["channels", "related", channel?.category?.id],
    queryFn:  () => channels.list({
      categoryId: channel!.category!.id,
      limit:      20,
    }),
    enabled: !!channel?.category?.id,
  });

  // ── Start stream session ──────────────────────────────────────────────────
  useEffect(() => {
    if (!channel || !accessToken) return;
    let cancelled = false;

    setChannel(channel);
    addToRecent(channel.id);
    setStatus("loading");
    setCurrentUrl(null);

    streamApi.start(channel.id, accessToken)
      .then(sess => {
        if (cancelled) return;
        setSession(sess);
        setCurrentUrl(sess.url);
        setCurrentSourceId(sess.sourceId);
      })
      .catch(() => {
        if (cancelled) return;
        setSessionError("Unable to start stream. Please try again.");
        setStatus("error");
      });

    return () => { cancelled = true; };
  }, [channel, accessToken, setChannel, setSession, setStatus, addToRecent]);

  // ── Check favorite status ─────────────────────────────────────────────────
  useEffect(() => {
    if (!channel || !accessToken) return;
    favorites.check(channel.id, accessToken)
      .then(r => setIsFavorite(r.isFavorite))
      .catch(() => {});
  }, [channel, accessToken]);

  // ── Failover handler (called from player) ─────────────────────────────────
  const handleSwitch = useCallback((newUrl: string, newSourceId: string) => {
    setCurrentUrl(newUrl);
    setCurrentSourceId(newSourceId);
  }, []);

  // ── Favorite toggle ───────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async () => {
    if (!channel || !accessToken) return;
    const result = await favorites.toggle(channel.id, accessToken).catch(() => null);
    if (result) setIsFavorite(result.isFavorite);
  }, [channel, accessToken]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen animate-fade-in">
      {/* Back button */}
      <div className="flex items-center gap-4 px-4 md:px-8 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-vx-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
      </div>

      <div className="px-4 md:px-8">
        {/* Player */}
        <div className="w-full mb-6">
          {isLoading || !currentUrl ? (
            <div className="w-full aspect-video bg-vx-card rounded-xl animate-pulse flex items-center justify-center">
              {sessionError ? (
                <div className="text-center">
                  <p className="text-vx-muted mb-4">{sessionError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-vx-accent rounded-lg text-white text-sm"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {channel?.logoUrl && (
                    <div className="w-16 h-16 relative">
                      <Image src={channel.logoUrl} alt={channel?.name ?? ""} fill className="object-contain" unoptimized />
                    </div>
                  )}
                  <p className="text-vx-muted text-sm">Starting stream…</p>
                </div>
              )}
            </div>
          ) : (
            <VideoPlayer
              url={currentUrl}
              type={(currentUrl.includes(".m3u8") ? "hls" : "mp4") as "hls" | "mp4"}
              sourceId={currentSourceId ?? ""}
              channelId={id}
              channelName={channel?.name ?? ""}
              logo={channel?.logoUrl}
              onSwitch={handleSwitch}
            />
          )}
        </div>

        {/* Channel info */}
        {channel && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start justify-between gap-4 mb-8"
          >
            <div className="flex items-center gap-4">
              {channel.logoUrl && (
                <div className="w-14 h-14 relative shrink-0 rounded-xl overflow-hidden bg-vx-card border border-vx-border">
                  <Image src={channel.logoUrl} alt={channel.name} fill className="object-contain p-2" unoptimized />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white">{channel.name}</h1>
                {channel.nameAr && (
                  <p className="text-vx-muted text-sm" dir="rtl">{channel.nameAr}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {channel.category && (
                    <span className="text-vx-accent text-xs font-medium">{channel.category.name}</span>
                  )}
                  {channel.country && (
                    <span className="text-vx-subtle text-xs">{channel.country}</span>
                  )}
                  <span className="flex items-center gap-1 text-vx-live text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-vx-live animate-pulse-live" />
                    LIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFavorite}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                  isFavorite
                    ? "bg-vx-accent border-vx-accent text-white"
                    : "border-vx-border text-vx-muted hover:text-white hover:border-white/30"
                )}
              >
                <Heart className={clsx("w-4 h-4", isFavorite && "fill-current")} />
                {isFavorite ? "Favorited" : "Favorite"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Related channels */}
        {related?.data && related.data.length > 0 && (
          <ChannelRow
            title={`More from ${channel?.category?.name ?? "this category"}`}
            channels={related.data.filter(c => c.id !== id)}
            onPlay={(ch) => router.push(`/tv/watch/${ch.id}`)}
            size="sm"
          />
        )}
      </div>
    </div>
  );
}
