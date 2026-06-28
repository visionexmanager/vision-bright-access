"use client";

import { use, useState, useMemo } from "react";
import { useRouter }    from "next/navigation";
import { useQuery }     from "@tanstack/react-query";
import { useInView }    from "react-intersection-observer";
import { motion }       from "framer-motion";
import { ArrowLeft, Grid3X3, List, AlignLeft } from "lucide-react";
import { channels }     from "@/lib/api";
import type { Channel } from "@/lib/api";
import { ChannelCard }  from "@/components/tv/ChannelCard";
import { SkeletonCard } from "@/components/tv/SkeletonCard";

const PAGE_SIZE = 40;

interface Props { params: Promise<{ slug: string }> }

export default function CategoryPage({ params }: Props) {
  const { slug } = use(params);
  const router   = useRouter();
  const [view,   setView]  = useState<"grid" | "list">("grid");
  const [offset, setOffset] = useState(0);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => channels.categories(),
  });
  const cat = cats?.find(c => c.slug === slug);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["channels", "category", slug, offset],
    queryFn:  () => channels.list({ categoryId: cat?.id, limit: PAGE_SIZE, offset }),
    enabled:  !!cat?.id,
    staleTime: 60_000,
  });

  // Accumulate pages
  useMemo(() => {
    if (data?.data) {
      setAllChannels(prev =>
        offset === 0
          ? data.data
          : [...prev, ...data.data.filter(c => !prev.find(p => p.id === c.id))]
      );
    }
  }, [data, offset]);

  // Infinite scroll sentinel
  const { ref: sentinelRef } = useInView({
    onChange: (inView) => {
      if (inView && data && allChannels.length < data.total && !isFetching) {
        setOffset(o => o + PAGE_SIZE);
      }
    },
  });

  return (
    <div className="min-h-screen px-4 md:px-8 py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="text-vx-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {cat?.name ?? slug}
          </h1>
          {data?.total != null && (
            <p className="text-vx-muted text-sm mt-0.5">{data.total} channels</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg transition-all ${view === "grid" ? "bg-vx-accent text-white" : "text-vx-muted hover:text-white"}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-2 rounded-lg transition-all ${view === "list" ? "bg-vx-accent text-white" : "text-vx-muted hover:text-white"}`}
          >
            <AlignLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Channel grid */}
      {isLoading && offset === 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={
              view === "grid"
                ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
                : "flex flex-col gap-2"
            }
          >
            {allChannels.map((ch, i) => (
              view === "grid" ? (
                <ChannelCard
                  key={ch.id}
                  channel={ch}
                  onPlay={() => router.push(`/tv/watch/${ch.id}`)}
                />
              ) : (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="flex items-center gap-4 p-3 bg-vx-card border border-vx-border rounded-xl hover:border-white/20 cursor-pointer transition-all"
                  onClick={() => router.push(`/tv/watch/${ch.id}`)}
                >
                  <div className="w-14 h-10 relative shrink-0 rounded-lg overflow-hidden bg-vx-surface">
                    {ch.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.logoUrl} alt={ch.name} className="w-full h-full object-contain p-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{ch.name}</p>
                    <p className="text-vx-muted text-xs">{ch.country} · {ch.quality}</p>
                  </div>
                  <span className="flex items-center gap-1 text-vx-live text-[10px] font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-vx-live animate-pulse-live" />
                    LIVE
                  </span>
                </motion.div>
              )
            ))}
          </motion.div>

          {/* Infinite scroll sentinel */}
          {allChannels.length < (data?.total ?? 0) && (
            <div ref={sentinelRef} className="mt-8 flex justify-center">
              {isFetching && (
                <div className="flex gap-3">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} size="sm" />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
