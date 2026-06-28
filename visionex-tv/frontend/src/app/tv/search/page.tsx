"use client";

import { useState, useMemo } from "react";
import { useRouter }   from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useDebounce } from "use-debounce";
import { motion }      from "framer-motion";
import { useQuery }    from "@tanstack/react-query";
import { channels }    from "@/lib/api";
import type { Channel } from "@/lib/api";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { SkeletonCard } from "@/components/tv/SkeletonCard";

const QUALITIES = ["All", "SD", "HD", "FHD"];

export default function SearchPage() {
  const router = useRouter();
  const [query,    setQuery]    = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [quality,  setQuality]  = useState<string | undefined>();
  const [country,  setCountry]  = useState<string | undefined>();
  const [sort,     setSort]     = useState<"popular" | "alpha">("popular");
  const [dq]                   = useDebounce(query, 300);

  const { data: cats } = useQuery({
    queryKey: ["categories"],
    queryFn:  () => channels.categories(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["search", dq, category, quality, country],
    queryFn:  () => channels.list({
      search:     dq || undefined,
      categoryId: category,
      quality:    quality,
      country:    country,
      limit:      60,
    }),
    staleTime: 5_000,
  });

  const sorted = useMemo(() => {
    const list = data?.data ?? [];
    if (sort === "alpha") return [...list].sort((a, b) => a.name.localeCompare(b.name));
    return [...list].sort((a, b) => b.viewCount - a.viewCount);
  }, [data, sort]);

  return (
    <div className="min-h-screen px-4 md:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Search</h1>

      {/* Search input */}
      <div className="flex items-center gap-3 bg-vx-card border border-vx-border rounded-xl px-4 py-3 mb-6 focus-within:border-white/30 transition-colors">
        <Search className="w-5 h-5 text-vx-muted shrink-0" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search channels, categories, countries…"
          className="flex-1 bg-transparent text-white placeholder:text-vx-subtle outline-none text-base"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-vx-muted hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCategory(undefined)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              !category ? "bg-vx-accent text-white" : "bg-vx-card border border-vx-border text-vx-muted hover:text-white"
            }`}
          >
            All
          </button>
          {(cats ?? []).map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(c => c === cat.id ? undefined : cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                category === cat.id
                  ? "bg-vx-accent text-white"
                  : "bg-vx-card border border-vx-border text-vx-muted hover:text-white"
              }`}
            >
              {cat.name}
              <span className="ml-1 text-[10px] opacity-60">({cat.channelCount})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quality + Sort row */}
      <div className="flex items-center gap-3 mb-6">
        {QUALITIES.map(q => (
          <button
            key={q}
            onClick={() => setQuality(q === "All" ? undefined : q)}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              (quality ?? "All") === q
                ? "bg-vx-gold/20 text-vx-gold border border-vx-gold/30"
                : "bg-vx-card border border-vx-border text-vx-muted hover:text-white"
            }`}
          >
            {q}
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-vx-muted" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as "popular" | "alpha")}
            className="bg-vx-card border border-vx-border text-vx-muted text-sm rounded-lg px-2 py-1 outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="alpha">A → Z</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {Array.from({ length: 24 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Search className="w-12 h-12 text-vx-border mx-auto mb-4" />
          <p className="text-vx-muted text-lg">
            {query ? `No results for "${query}"` : "Start typing to search"}
          </p>
        </motion.div>
      ) : (
        <>
          <p className="text-vx-muted text-sm mb-4">
            {data?.total ?? sorted.length} channels found
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
          >
            {sorted.map(ch => (
              <ChannelCard
                key={ch.id}
                channel={ch}
                onPlay={() => router.push(`/tv/watch/${ch.id}`)}
              />
            ))}
          </motion.div>
        </>
      )}
    </div>
  );
}
