import type {
  MarketQuote,
  Portfolio,
  Watchlist,
  WatchlistItem,
  EconomicEvent,
  MarketNewsArticle,
  BrokerInfo,
  AffiliateStats,
  AIAnalystSignal,
  AssetClass,
} from "@/lib/types/finance";
import { supabase } from "@/integrations/supabase/client";

// ── Quotes ────────────────────────────────────────────────────────────────────

export async function fetchQuotes(
  symbols: string[],
  _assetClass?: AssetClass
): Promise<MarketQuote[]> {
  void symbols;
  return [];
}

export async function fetchQuote(symbol: string): Promise<MarketQuote | null> {
  void symbol;
  return null;
}

export async function searchSymbols(
  query: string,
  assetClass?: AssetClass
): Promise<MarketQuote[]> {
  void query;
  void assetClass;
  return [];
}

// ── Portfolio ─────────────────────────────────────────────────────────────────

export async function fetchPortfolios(userId: string): Promise<Portfolio[]> {
  const { data: portfolios, error } = await supabase
    .from("finance_portfolios")
    .select("*, finance_holdings(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (portfolios ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    userId: p.user_id as string,
    name: p.name as string,
    currency: (p.currency as string) ?? "USD",
    totalValue: 0,
    totalCost: 0,
    totalPnl: 0,
    totalPnlPercent: 0,
    createdAt: p.created_at as string,
    updatedAt: p.updated_at as string,
    holdings: ((p.finance_holdings as Record<string, unknown>[]) ?? []).map((h) => ({
      id: h.id as string,
      symbol: h.symbol as string,
      name: h.name as string,
      assetClass: (h.asset_class as AssetClass) ?? "stock",
      quantity: Number(h.quantity) || 0,
      avgBuyPrice: Number(h.avg_buy_price) || 0,
      currentPrice: 0,
      currency: (h.currency as string) ?? "USD",
      pnl: 0,
      pnlPercent: 0,
    })),
  }));
}

export async function fetchPortfolio(id: string): Promise<Portfolio | null> {
  const { data, error } = await supabase
    .from("finance_portfolios")
    .select("*, finance_holdings(*)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return fetchPortfolios(data.user_id).then((ps) => ps.find((p) => p.id === id) ?? null);
}

export async function createPortfolio(
  userId: string,
  name: string
): Promise<Portfolio | null> {
  const { data, error } = await supabase
    .from("finance_portfolios")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create portfolio");
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    currency: data.currency ?? "USD",
    totalValue: 0, totalCost: 0, totalPnl: 0, totalPnlPercent: 0,
    holdings: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function addPortfolioHolding(
  portfolioId: string,
  holding: { symbol: string; name: string; assetClass: AssetClass; quantity: number; avgBuyPrice: number; currency?: string }
): Promise<void> {
  const { error } = await supabase.from("finance_holdings").insert({
    portfolio_id: portfolioId,
    symbol: holding.symbol,
    name: holding.name,
    asset_class: holding.assetClass,
    quantity: holding.quantity,
    avg_buy_price: holding.avgBuyPrice,
    currency: holding.currency ?? "USD",
  });
  if (error) throw error;
}

export async function removePortfolioHolding(holdingId: string): Promise<void> {
  const { error } = await supabase.from("finance_holdings").delete().eq("id", holdingId);
  if (error) throw error;
}

export async function deletePortfolio(portfolioId: string): Promise<void> {
  const { error } = await supabase.from("finance_portfolios").delete().eq("id", portfolioId);
  if (error) throw error;
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export async function fetchWatchlists(userId: string): Promise<Watchlist[]> {
  const { data, error } = await supabase
    .from("finance_watchlists")
    .select("*, finance_watchlist_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((w: Record<string, unknown>) => ({
    id: w.id as string,
    userId: w.user_id as string,
    name: w.name as string,
    createdAt: w.created_at as string,
    items: ((w.finance_watchlist_items as Record<string, unknown>[]) ?? []).map((i) => ({
      id: i.id as string,
      symbol: i.symbol as string,
      name: i.name as string,
      assetClass: (i.asset_class as AssetClass) ?? "stock",
      addedAt: i.added_at as string,
      note: i.note as string | undefined,
      alertPrice: i.alert_price ? Number(i.alert_price) : undefined,
    })),
  }));
}

export async function fetchWatchlist(id: string): Promise<Watchlist | null> {
  const { data, error } = await supabase
    .from("finance_watchlists")
    .select("*, finance_watchlist_items(*)")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    createdAt: data.created_at,
    items: (data.finance_watchlist_items ?? []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      symbol: i.symbol as string,
      name: i.name as string,
      assetClass: (i.asset_class as AssetClass) ?? "stock",
      addedAt: i.added_at as string,
      note: i.note as string | undefined,
      alertPrice: i.alert_price ? Number(i.alert_price) : undefined,
    })),
  };
}

export async function createWatchlist(
  userId: string,
  name: string
): Promise<Watchlist | null> {
  const { data, error } = await supabase
    .from("finance_watchlists")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create watchlist");
  return { id: data.id, userId: data.user_id, name: data.name, createdAt: data.created_at, items: [] };
}

export async function addWatchlistItem(
  watchlistId: string,
  item: Pick<WatchlistItem, "symbol" | "name" | "assetClass">
): Promise<WatchlistItem | null> {
  const { data, error } = await supabase
    .from("finance_watchlist_items")
    .insert({ watchlist_id: watchlistId, symbol: item.symbol, name: item.name, asset_class: item.assetClass })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to add item");
  return {
    id: data.id,
    symbol: data.symbol,
    name: data.name,
    assetClass: (data.asset_class as AssetClass) ?? "stock",
    addedAt: data.added_at,
  };
}

export async function removeWatchlistItem(
  watchlistId: string,
  itemId: string
): Promise<void> {
  void watchlistId;
  const { error } = await supabase.from("finance_watchlist_items").delete().eq("id", itemId);
  if (error) throw error;
}

// ── Economic Calendar ─────────────────────────────────────────────────────────

export async function fetchEconomicEvents(
  from: string,
  to: string
): Promise<EconomicEvent[]> {
  void from;
  void to;
  return [];
}

// ── Market News ───────────────────────────────────────────────────────────────

export async function fetchMarketNews(
  page?: number,
  symbols?: string[]
): Promise<MarketNewsArticle[]> {
  void page;
  void symbols;
  return [];
}

// ── Brokers ───────────────────────────────────────────────────────────────────

export async function fetchBrokers(): Promise<BrokerInfo[]> {
  return [];
}

export async function fetchBroker(id: string): Promise<BrokerInfo | null> {
  void id;
  return null;
}

// ── Affiliate ─────────────────────────────────────────────────────────────────

export async function fetchAffiliateStats(
  userId: string,
  period: AffiliateStats["period"]
): Promise<AffiliateStats> {
  void userId;
  return {
    totalClicks: 0,
    totalConversions: 0,
    totalEarnings: 0,
    currency: "USD",
    period,
  };
}

export async function trackAffiliateClick(
  userId: string,
  brokerId: string
): Promise<void> {
  void userId;
  void brokerId;
}

// ── AI Analyst ────────────────────────────────────────────────────────────────

export async function fetchAISignals(
  symbols: string[]
): Promise<AIAnalystSignal[]> {
  void symbols;
  return [];
}

export async function generateAISignal(
  symbol: string,
  timeframe: AIAnalystSignal["timeframe"]
): Promise<AIAnalystSignal | null> {
  void symbol;
  void timeframe;
  return null;
}
