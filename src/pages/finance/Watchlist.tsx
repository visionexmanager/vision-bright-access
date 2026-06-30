import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Star, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssetClass } from "@/lib/types/finance";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WatchlistEntry {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  addedAt: string;
  note?: string;
}

interface CoinPrice {
  id: string;
  current_price: number;
  price_change_percentage_24h: number | null;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = "vx_finance_watchlist";

function loadWatchlist(): WatchlistEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as WatchlistEntry[]) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchlistEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

// ── CoinGecko ID map for common crypto symbols ────────────────────────────────

const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDT: "tether",
  USDC: "usd-coin",
  ADA: "cardano",
  AVAX: "avalanche-2",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  LTC: "litecoin",
  ATOM: "cosmos",
  UNI: "uniswap",
  TRX: "tron",
  TON: "the-open-network",
};

// ── Fetch live crypto prices ──────────────────────────────────────────────────

async function fetchCryptoPrices(symbols: string[]): Promise<CoinPrice[]> {
  const ids = symbols
    .map((s) => SYMBOL_TO_COINGECKO_ID[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false`
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  stock: "Stock",
  crypto: "Crypto",
  currency: "Forex",
  commodity: "Commodity",
  index: "Index",
};

const ASSET_CLASS_COLOR: Record<AssetClass, string> = {
  stock: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  crypto: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  currency: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  commodity: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  index: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

function fmtUSD(v: number) {
  if (v >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(v);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(v);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinanceWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(loadWatchlist);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    symbol: "",
    name: "",
    assetClass: "stock" as AssetClass,
    note: "",
  });

  // ── Live crypto prices ───────────────────────────────────────────────────────

  const cryptoSymbols = watchlist
    .filter((e) => e.assetClass === "crypto")
    .map((e) => e.symbol);

  const { data: cryptoPrices = [] } = useQuery({
    queryKey: ["finance", "watchlist-prices", cryptoSymbols.join(",")],
    queryFn: () => fetchCryptoPrices(cryptoSymbols),
    enabled: cryptoSymbols.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const priceBySymbol: Record<string, CoinPrice> = {};
  for (const p of cryptoPrices) {
    const symbol = Object.entries(SYMBOL_TO_COINGECKO_ID).find(
      ([, id]) => id === p.id
    )?.[0];
    if (symbol) priceBySymbol[symbol] = p;
  }

  // ── Mutators ─────────────────────────────────────────────────────────────────

  const persist = useCallback((items: WatchlistEntry[]) => {
    setWatchlist(items);
    saveWatchlist(items);
  }, []);

  const handleAdd = () => {
    if (!form.symbol.trim()) return;
    const entry: WatchlistEntry = {
      id: crypto.randomUUID(),
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || form.symbol.trim().toUpperCase(),
      assetClass: form.assetClass,
      addedAt: new Date().toISOString(),
      note: form.note.trim() || undefined,
    };
    persist([...watchlist, entry]);
    setForm({ symbol: "", name: "", assetClass: "stock", note: "" });
    setAddOpen(false);
  };

  const handleRemove = (id: string) => {
    persist(watchlist.filter((e) => e.id !== id));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const addAction = (
    <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
      <Plus className="h-4 w-4" />
      Add Symbol
    </Button>
  );

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Watchlist"
        description="Monitor symbols you care about. Crypto entries show live prices."
        actions={addAction}
      >
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-4">
            <Star className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-semibold text-base">Your watchlist is empty</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Add stocks, crypto, forex pairs, or commodities you want to track.
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Symbol
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((entry) => {
              const livePrice = priceBySymbol[entry.symbol];
              const change = livePrice?.price_change_percentage_24h ?? null;
              const isPos = change !== null && change >= 0;
              const isNeg = change !== null && change < 0;

              return (
                <Card
                  key={entry.id}
                  className="relative group hover:shadow-md transition-shadow duration-200"
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base">{entry.symbol}</span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              ASSET_CLASS_COLOR[entry.assetClass]
                            }`}
                          >
                            {ASSET_CLASS_LABEL[entry.assetClass]}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5 truncate">
                          {entry.name}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => handleRemove(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Live price for crypto */}
                    {livePrice && (
                      <div className="mt-3 flex items-end justify-between">
                        <span className="font-mono text-lg font-semibold">
                          {fmtUSD(livePrice.current_price)}
                        </span>
                        {change !== null && (
                          <span
                            className={`flex items-center gap-1 text-sm font-medium ${
                              isPos
                                ? "text-green-500"
                                : isNeg
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }`}
                          >
                            {isPos ? (
                              <TrendingUp className="h-3.5 w-3.5" />
                            ) : isNeg ? (
                              <TrendingDown className="h-3.5 w-3.5" />
                            ) : null}
                            {isPos ? "+" : ""}
                            {change.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    )}

                    {/* Note if any */}
                    {entry.note && (
                      <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                        {entry.note}
                      </p>
                    )}

                    <div className="text-xs text-muted-foreground mt-2">
                      Added {format(new Date(entry.addedAt), "MMM d, yyyy")}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </FinancePageShell>

      {/* Add Symbol Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Symbol to Watchlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Symbol (e.g. AAPL, BTC)"
                value={form.symbol}
                onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value }))}
                autoFocus
              />
              <Input
                placeholder="Name (e.g. Apple Inc.)"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <Select
              value={form.assetClass}
              onValueChange={(v) => setForm((f) => ({ ...f, assetClass: v as AssetClass }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">Stock</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="currency">Forex</SelectItem>
                <SelectItem value="commodity">Commodity</SelectItem>
                <SelectItem value="index">Index</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Note (optional)"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAdd} disabled={!form.symbol.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FinanceLayout>
  );
}
