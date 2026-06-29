import { useQuery } from "@tanstack/react-query";
import { fetchQuotes, fetchQuote, searchSymbols } from "@/services/finance";
import type { AssetClass } from "@/lib/types/finance";

export function useQuotes(symbols: string[], assetClass?: AssetClass) {
  return useQuery({
    queryKey: ["finance", "quotes", symbols, assetClass],
    queryFn: () => fetchQuotes(symbols, assetClass),
    enabled: symbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ["finance", "quote", symbol],
    queryFn: () => fetchQuote(symbol),
    enabled: Boolean(symbol),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useSymbolSearch(query: string, assetClass?: AssetClass) {
  return useQuery({
    queryKey: ["finance", "search", query, assetClass],
    queryFn: () => searchSymbols(query, assetClass),
    enabled: query.length >= 2,
    staleTime: 300_000,
  });
}
