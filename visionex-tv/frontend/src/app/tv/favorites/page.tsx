"use client";

import { useCallback }  from "react";
import { useRouter }    from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion }       from "framer-motion";
import { Heart, Tv }   from "lucide-react";
import { favorites }    from "@/lib/api";
import type { Channel } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { ChannelCard }  from "@/components/tv/ChannelCard";
import { SkeletonCard } from "@/components/tv/SkeletonCard";

export default function FavoritesPage() {
  const router      = useRouter();
  const accessToken = useAuthStore(s => s.accessToken);
  const qc          = useQueryClient();

  const { data, isLoading } = useQuery<Channel[]>({
    queryKey: ["favorites"],
    queryFn:  () => (accessToken ? favorites.list(accessToken) : Promise.resolve([])),
    enabled:  !!accessToken,
  });

  const handleFavorite = useCallback(async (ch: Channel) => {
    if (!accessToken) return;
    await favorites.toggle(ch.id, accessToken).catch(() => {});
    qc.invalidateQueries({ queryKey: ["favorites"] });
  }, [accessToken, qc]);

  const favoriteIds = new Set((data ?? []).map(c => c.id));

  return (
    <div className="min-h-screen px-4 md:px-8 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-6 h-6 text-vx-accent" />
        <h1 className="text-2xl font-bold text-white">My Favorites</h1>
        {data && (
          <span className="ml-auto text-vx-muted text-sm">{data.length} channels</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : !data?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-32 gap-4"
        >
          <Heart className="w-16 h-16 text-vx-border" />
          <h2 className="text-xl font-semibold text-white">No favorites yet</h2>
          <p className="text-vx-muted text-center max-w-xs">
            Browse channels and tap the heart icon to save them here for quick access.
          </p>
          <button
            onClick={() => router.push("/tv")}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-vx-accent rounded-lg text-white font-medium hover:bg-vx-accent-hover transition-colors"
          >
            <Tv className="w-4 h-4" />
            Browse Channels
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
        >
          {data.map((ch, i) => (
            <motion.div
              key={ch.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <ChannelCard
                channel={ch}
                isFavorite={favoriteIds.has(ch.id)}
                onPlay={() => router.push(`/tv/watch/${ch.id}`)}
                onFavorite={handleFavorite}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
