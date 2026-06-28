"use client";

import { useCallback, useMemo } from "react";
import { useRouter }             from "next/navigation";
import { useQuery }              from "@tanstack/react-query";
import { motion }                from "framer-motion";
import { Tv, TrendingUp, Star, Clock, Heart } from "lucide-react";
import { channels, favorites, recommendations, analytics } from "@/lib/api";
import type { Channel } from "@/lib/api";
import { useAuthStore }  from "@/store/auth.store";
import { usePlayerStore } from "@/store/player.store";
import { ChannelRow }    from "@/components/tv/ChannelRow";
import { SearchBar }     from "@/components/tv/SearchBar";
import { SkeletonHero }  from "@/components/tv/SkeletonCard";

export default function TvHomePage() {
  const router      = useRouter();
  const accessToken = useAuthStore(s => s.accessToken);
  const { recentIds, lastChannel } = usePlayerStore();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ["channels", "featured"],
    queryFn:  () => channels.list({ featured: true, limit: 20 }),
  });

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["channels", "trending"],
    queryFn:  () => analytics.topChannels(20),
  });

  const { data: favsData } = useQuery({
    queryKey: ["favorites"],
    queryFn:  () => (accessToken ? favorites.list(accessToken) : Promise.resolve([])),
    enabled:  !!accessToken,
  });

  const { data: recsData, isLoading: recsLoading } = useQuery({
    queryKey: ["recommendations"],
    queryFn:  () => (accessToken ? recommendations.forUser(accessToken, 20) : channels.list({ limit: 20 }).then(r => r.data)),
  });

  // Recent channels (from local store)
  const { data: allChannels } = useQuery({
    queryKey: ["channels", "all"],
    queryFn:  () => channels.list({ limit: 200 }),
  });

  const recentChannels = useMemo(() => {
    if (!allChannels?.data || !recentIds.length) return [];
    const map = new Map(allChannels.data.map(c => [c.id, c]));
    return recentIds.map(id => map.get(id)).filter(Boolean) as Channel[];
  }, [allChannels, recentIds]);

  const favoriteIds = useMemo(
    () => new Set((favsData ?? []).map(f => f.id)),
    [favsData]
  );

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handlePlay = useCallback((ch: Channel) => {
    router.push(`/tv/watch/${ch.id}`);
  }, [router]);

  const handleFavorite = useCallback((ch: Channel) => {
    if (!accessToken) return;
    favorites.toggle(ch.id, accessToken).catch(() => {});
  }, [accessToken]);

  // ── Hero section ───────────────────────────────────────────────────────────
  const hero = lastChannel ?? featuredData?.data?.[0];

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 animate-fade-in">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Tv className="w-6 h-6 text-vx-accent" />
          <h1 className="text-2xl font-bold text-white">Live TV</h1>
        </div>
        <SearchBar onPlay={handlePlay} />
      </div>

      {/* Hero — last watched / featured */}
      {featuredLoading ? (
        <SkeletonHero />
      ) : hero ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full h-52 md:h-72 rounded-2xl overflow-hidden mb-10 cursor-pointer group"
          onClick={() => handlePlay(hero)}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10" />
          {hero.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero.logoUrl}
              alt={hero.name}
              className="absolute inset-0 w-full h-full object-contain opacity-20"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-vx-accent/20 to-transparent" />

          <div className="absolute inset-0 z-20 flex flex-col justify-end p-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 bg-vx-live/20 text-vx-live text-xs font-bold px-2.5 py-1 rounded-full border border-vx-live/30">
                <span className="w-1.5 h-1.5 rounded-full bg-vx-live animate-pulse-live" />
                LIVE NOW
              </span>
              {hero.quality && (
                <span className="bg-vx-gold/20 text-vx-gold text-xs font-bold px-2.5 py-1 rounded-full border border-vx-gold/30">
                  {hero.quality}
                </span>
              )}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white text-shadow mb-2">
              {hero.name}
            </h2>
            {hero.category && (
              <p className="text-vx-muted text-sm">{hero.category.name}</p>
            )}
            <button className="mt-4 self-start flex items-center gap-2 bg-white text-black px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors group-hover:scale-105 transition-transform">
              <Tv className="w-4 h-4" />
              Watch Now
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* Continue watching */}
      {recentChannels.length > 0 && (
        <ChannelRow
          title="Continue Watching"
          channels={recentChannels}
          favoriteIds={favoriteIds}
          onPlay={handlePlay}
          onFavorite={handleFavorite}
          size="md"
        />
      )}

      {/* Favorites */}
      {(favsData?.length ?? 0) > 0 && (
        <ChannelRow
          title="My Favorites"
          channels={favsData ?? []}
          favoriteIds={favoriteIds}
          onPlay={handlePlay}
          onFavorite={handleFavorite}
          size="md"
        />
      )}

      {/* Featured */}
      <ChannelRow
        title="Featured Channels"
        channels={featuredData?.data ?? []}
        loading={featuredLoading}
        favoriteIds={favoriteIds}
        onPlay={handlePlay}
        onFavorite={handleFavorite}
        size="md"
      />

      {/* Trending */}
      <ChannelRow
        title="Trending Now"
        channels={trendingData ?? []}
        loading={trendingLoading}
        favoriteIds={favoriteIds}
        onPlay={handlePlay}
        onFavorite={handleFavorite}
        size="lg"
      />

      {/* Recommended */}
      <ChannelRow
        title="Recommended For You"
        channels={recsData ?? []}
        loading={recsLoading}
        favoriteIds={favoriteIds}
        onPlay={handlePlay}
        onFavorite={handleFavorite}
        size="md"
      />
    </div>
  );
}
