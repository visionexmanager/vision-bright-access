/**
 * LiveTVSearch
 *
 * Dedicated full-page search for TV channels.
 * Features: debounced input, category filter, instant results.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Search, X, ArrowLeft, ArrowRight, RefreshCw, Tv } from "lucide-react";
import { useTVSubscription } from "@/hooks/useTVSubscription";
import { useLanguage } from "@/contexts/LanguageContext";
import { TVSectionNav } from "@/components/tv/TVSectionNav";
import { ChannelCard } from "@/components/tv/ChannelCard";
import { FavoriteButton } from "@/components/tv/FavoriteButton";
import { detectType } from "@/components/OfficialStreamPlayer";
import { cn } from "@/lib/utils";
import type { TVChannel } from "@/hooks/useTVSubscription";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function LiveTVSearch() {
  const navigate     = useNavigate();
  const [params, setParams] = useSearchParams();
  const { dir }      = useLanguage();
  const isRTL        = dir === "rtl";
  const BackIcon     = isRTL ? ArrowRight : ArrowLeft;
  const inputRef     = useRef<HTMLInputElement>(null);

  const { channels, categories, isSubscribed, isLoading } = useTVSubscription();

  const [query,      setQuery]      = useState(params.get("q") ?? "");
  const [activeSlug, setActiveSlug] = useState("all");

  const debouncedQ = useDebounce(query, 250);

  // Sync query to URL params for shareability / browser history
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQ) next.set("q", debouncedQ);
    setParams(next, { replace: true });
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    let list = channels;

    if (activeSlug !== "all") list = list.filter(c => c.category?.slug === activeSlug);

    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.name_ar.includes(debouncedQ.trim()) ||
        c.country?.toLowerCase().includes(q) ||
        c.category?.name.toLowerCase().includes(q) ||
        c.category?.name_ar.includes(debouncedQ.trim())
      );
    }
    return list;
  }, [channels, debouncedQ, activeSlug]);

  const handleClick = (ch: TVChannel) => {
    const type = detectType(ch.official_url ?? "");
    if (type === "external" && ch.official_url) {
      window.open(ch.official_url, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/services/live-tv/watch/${ch.id}`);
    }
  };

  const catName = (cat: { name: string; name_ar: string }) =>
    isRTL ? cat.name_ar : cat.name;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6" dir={dir}>

        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Link to="/services/live-tv" className="text-muted-foreground hover:text-foreground transition-colors">
            <BackIcon className="w-5 h-5" />
          </Link>
          <h1 className="font-bold text-xl text-foreground">
            {isRTL ? "بحث عن قنوات" : "Search Channels"}
          </h1>
        </div>

        {/* Section nav */}
        <TVSectionNav />

        {/* Search input */}
        <div className="relative max-w-xl">
          <Search className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none",
            isRTL ? "right-3" : "left-3"
          )} />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isRTL ? "ابحث عن قناة، بلد، تصنيف…" : "Search channel, country, category…"}
            className={cn("text-base h-11", isRTL ? "pr-10 pe-10" : "pl-10")}
            dir={dir}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                isRTL ? "left-3" : "right-3"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSlug("all")}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              activeSlug === "all"
                ? "bg-blue-500 text-white border-blue-500"
                : "border-border text-muted-foreground hover:border-blue-400/40 hover:text-foreground"
            )}
          >
            {isRTL ? "الكل" : "All"} ({channels.length})
          </button>
          {categories.map(cat => {
            const count = channels.filter(c => c.category?.slug === cat.slug).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveSlug(cat.slug)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  activeSlug === cat.slug
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-border text-muted-foreground hover:border-blue-400/40"
                )}
              >
                {catName(cat)} ({count})
              </button>
            );
          })}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
        ) : !debouncedQ && activeSlug === "all" ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {isRTL ? "اكتب اسم القناة للبحث" : "Type a channel name to search"}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Tv className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {isRTL ? "لا توجد نتائج" : "No results found"}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? `${filtered.length} نتيجة`
                : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(ch => (
                <div key={ch.id} className="relative">
                  <ChannelCard
                    channel={ch}
                    isSubscribed={isSubscribed}
                    onClick={handleClick}
                  />
                  <div className="absolute top-1.5 end-8">
                    <FavoriteButton channelId={ch.id} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
