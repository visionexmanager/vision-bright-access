/**
 * useSmartSearch — debounced semantic (RAG) search via aiService.search().
 *
 * Returns results, loading, and a setter. Restrict scope with `source`
 * ("products" | "content_items") or leave undefined for both.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { aiService } from "@/services/ai/aiService";
import type { SearchResult } from "@/lib/types";

export function useSmartSearch<T = Record<string, unknown>>(source?: string, limit = 8) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(
    async (q: string) => {
      abortRef.current?.abort();
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const { results } = await aiService.search<T>(trimmed, source, limit, controller.signal);
        setResults(results);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [source, limit],
  );

  // Debounce query changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { query, setQuery, results, loading, error };
}
