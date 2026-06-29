"use client";
import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "use-debounce";
import { motion, AnimatePresence } from "framer-motion";
import { ChannelCard } from "./ChannelCard";
import { channels } from "@/lib/api";
import type { Channel } from "@/lib/api";

interface Props {
  onPlay: (ch: Channel) => void;
}

export function SearchBar({ onPlay }: Props) {
  const [query,  setQuery]   = useState("");
  const [results, setResults] = useState<Channel[]>([]);
  const [open,   setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery]     = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    channels.list({ search: debouncedQuery, limit: 12 })
      .then(res => { if (!cancelled) setResults(res.data ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const clear = () => { setQuery(""); setResults([]); };

  return (
    <div className="relative w-full max-w-md">
      {/* Input */}
      <div className="flex items-center gap-2 bg-vx-card border border-vx-border rounded-xl px-4 py-2.5 focus-within:border-white/30 transition-colors">
        <Search className="w-4 h-4 text-vx-muted shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Search channels, categories…"
          className="flex-1 bg-transparent text-white text-sm placeholder:text-vx-subtle outline-none"
          aria-label="Search"
        />
        {query && (
          <button onClick={clear} className="text-vx-muted hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown results */}
      <AnimatePresence>
        {open && (query.trim() || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-vx-surface border border-vx-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {loading && (
              <div className="p-4 text-center text-vx-muted text-sm">Searching…</div>
            )}
            {!loading && results.length === 0 && query.trim() && (
              <div className="p-4 text-center text-vx-muted text-sm">
                No channels found for &quot;{query}&quot;
              </div>
            )}
            {results.length > 0 && (
              <div className="p-3">
                <p className="text-vx-subtle text-xs mb-3 px-1">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {results.map(ch => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      onPlay={(c) => { onPlay(c); clear(); }}
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
