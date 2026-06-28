"use client";

import { useRouter }     from "next/navigation";
import { useQuery }      from "@tanstack/react-query";
import { motion }        from "framer-motion";
import { Clock, Play }   from "lucide-react";
import Image             from "next/image";
import { users }         from "@/lib/api";
import type { WatchHistoryItem } from "@/lib/api";
import { useAuthStore }  from "@/store/auth.store";
import { formatDistanceToNow } from "date-fns";

function formatDuration(sec: number): string {
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function HistoryPage() {
  const router      = useRouter();
  const accessToken = useAuthStore(s => s.accessToken);

  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn:  () => (accessToken ? users.history(accessToken, 50) : Promise.resolve({ data: [], total: 0 })),
    enabled:  !!accessToken,
  });

  const items: WatchHistoryItem[] = data?.data ?? [];

  return (
    <div className="min-h-screen px-4 md:px-8 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="w-6 h-6 text-vx-accent" />
        <h1 className="text-2xl font-bold text-white">Watch History</h1>
        {data?.total ? (
          <span className="ml-auto text-vx-muted text-sm">{data.total} entries</span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4">
          <Clock className="w-16 h-16 text-vx-border" />
          <p className="text-vx-muted">No watch history yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="flex items-center gap-4 p-4 bg-vx-card border border-vx-border rounded-xl hover:border-white/20 transition-all group cursor-pointer"
              onClick={() => router.push(`/tv/watch/${item.channelId}`)}
            >
              {/* Logo */}
              <div className="w-12 h-12 relative shrink-0 rounded-lg overflow-hidden bg-vx-surface">
                {item.logoUrl ? (
                  <Image src={item.logoUrl} alt={item.name} fill className="object-contain p-1" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-vx-border" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{item.name}</p>
                <p className="text-vx-muted text-xs mt-0.5">
                  Watched {formatDistanceToNow(new Date(item.watchedAt), { addSuffix: true })}
                  {" · "}{formatDuration(item.durationSec)}
                  {" · "}<span className="text-vx-gold">{item.quality}</span>
                </p>
              </div>

              {/* Play button */}
              <button className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-vx-accent flex items-center justify-center">
                <Play className="w-4 h-4 text-white fill-white ml-0.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
