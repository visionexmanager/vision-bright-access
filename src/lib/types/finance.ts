// ─── Visionex Finance — Type Definitions ────────────────────────────────────

export type FinancePermission =
  | "finance.view"
  | "finance.portfolio"
  | "finance.watchlist"
  | "finance.ai_analyst"
  | "finance.affiliate"
  | "finance.admin";

export type AssetClass = "stock" | "currency" | "commodity" | "crypto" | "index";

export type TrendDirection = "up" | "down" | "flat";

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  currency: string;
  assetClass: AssetClass;
  trend: TrendDirection;
  updatedAt: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  pnl: number;
  pnlPercent: number;
}

export interface Portfolio {
  id: string;
  userId: string;
  name: string;
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
  currency: string;
  holdings: PortfolioHolding[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  addedAt: string;
  note?: string;
  alertPrice?: number;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItem[];
  createdAt: string;
}

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;
  time: string;
  impact: "low" | "medium" | "high";
  forecast?: string;
  previous?: string;
  actual?: string;
  currency: string;
}

export interface MarketNewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt: string;
  sentiment?: "positive" | "negative" | "neutral";
  tags: string[];
  relatedSymbols: string[];
}

export interface BrokerInfo {
  id: string;
  name: string;
  logo?: string;
  rating: number;
  reviewCount: number;
  regulation: string[];
  minDeposit: number;
  currency: string;
  spread: string;
  leverage: string;
  platforms: string[];
  assets: AssetClass[];
  pros: string[];
  cons: string[];
  affiliateUrl?: string;
  founded?: number;
}

export interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  currency: string;
  period: "today" | "week" | "month" | "all";
}

export interface AIAnalystSignal {
  symbol: string;
  signal: "buy" | "sell" | "hold";
  confidence: number;
  reasoning: string;
  targetPrice?: number;
  stopLoss?: number;
  timeframe: "short" | "medium" | "long";
  generatedAt: string;
}

export interface FinanceSettings {
  defaultCurrency: string;
  defaultWatchlistId?: string;
  defaultPortfolioId?: string;
  showChangePercent: boolean;
  compactView: boolean;
  refreshInterval: number;
}

export type FinanceSection =
  | "dashboard"
  | "markets"
  | "markets/stocks"
  | "markets/currencies"
  | "markets/commodities"
  | "portfolio"
  | "watchlist"
  | "ai-analyst"
  | "calendar"
  | "news"
  | "affiliate"
  | "brokers"
  | "academy";
