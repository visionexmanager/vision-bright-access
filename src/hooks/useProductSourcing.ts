import { useCallback, useEffect, useRef, useState } from "react";
import { aiService } from "@/services/ai/aiService";
import type { SourcedItem, SourcingCondition, SourcingResponse } from "@/lib/types";

export type ConditionFilter = SourcingCondition | "all";

const EMPTY: SourcingResponse["results"] = { new: [], used: [], refurbished: [] };

/**
 * Drives the Commerce Agent from the UI.
 *
 * Holds the last query so a condition filter re-runs the same request rather
 * than making the user retype it, and aborts an in-flight search when a new
 * one starts so a slow first request cannot overwrite a fast second one.
 */
export function useProductSourcing(channel = "website") {
  const [results, setResults] = useState<SourcingResponse["results"]>(EMPTY);
  const [total, setTotal] = useState(0);
  const [searchedExternally, setSearchedExternally] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [condition, setCondition] = useState<ConditionFilter>("all");
  const [selected, setSelected] = useState<SourcedItem[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (nextQuery: string, nextCondition: ConditionFilter = "all") => {
      const trimmed = nextQuery.trim();
      if (trimmed.length < 2) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setQuery(trimmed);
      setCondition(nextCondition);
      setLoading(true);
      setError(null);

      try {
        const response = await aiService.sourceProducts(trimmed, nextCondition, channel, controller.signal);
        if (controller.signal.aborted) return;
        setResults(response.results ?? EMPTY);
        setTotal(response.total ?? 0);
        setSearchedExternally(Boolean(response.searchedExternally));
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Sourcing failed");
        setResults(EMPTY);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [channel],
  );

  /** Re-runs the stored query, so filtering does not lose what was asked. */
  const filterByCondition = useCallback(
    (next: ConditionFilter) => {
      if (query) void run(query, next);
    },
    [query, run],
  );

  const toggleSelected = useCallback((item: SourcedItem) => {
    setSelected((current) =>
      current.some((entry) => entry.ref === item.ref)
        ? current.filter((entry) => entry.ref !== item.ref)
        : [...current, item],
    );
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResults(EMPTY);
    setTotal(0);
    setSelected([]);
    setQuery("");
    setCondition("all");
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    results, total, loading, error, query, condition, searchedExternally,
    selected, run, filterByCondition, toggleSelected, clearSelection: () => setSelected([]), reset,
  };
}
