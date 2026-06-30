import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number | null;
  total_volume: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatMarketCap(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchCryptoMarkets(): Promise<CoinMarket[]> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false"
  );
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Markets() {
  const {
    data: coins = [],
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["finance", "crypto-markets"],
    queryFn: fetchCryptoMarkets,
    staleTime: 60_000,
    retry: 2,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const refreshAction = (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <span className="text-xs text-muted-foreground hidden sm:block">
          Updated {lastUpdated}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => refetch()}
        disabled={isFetching}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        Refresh
      </Button>
    </div>
  );

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Crypto Markets"
        description="Top 20 cryptocurrencies by market cap — live prices via CoinGecko."
        actions={refreshAction}
      >
        {isLoading ? (
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/30 px-4 py-3 grid grid-cols-5 gap-4">
              {["Rank", "Name", "Price", "24h Change", "Market Cap"].map((h) => (
                <Skeleton key={h} className="h-4 w-full" />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 grid grid-cols-5 gap-4 border-t">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-3">
            <TrendingUp className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-semibold">Failed to load market data</p>
            <p className="text-sm text-muted-foreground">
              CoinGecko may be temporarily unavailable. Try again in a moment.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">24h Change</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Market Cap</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Volume (24h)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coins.map((coin) => {
                  const change = coin.price_change_percentage_24h ?? 0;
                  const isPositive = change > 0;
                  const isNegative = change < 0;
                  const changeClass = isPositive
                    ? "text-green-500"
                    : isNegative
                    ? "text-red-500"
                    : "text-muted-foreground";
                  const ChangeIcon = isPositive
                    ? TrendingUp
                    : isNegative
                    ? TrendingDown
                    : Minus;

                  return (
                    <TableRow key={coin.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-center text-sm text-muted-foreground font-medium">
                        {coin.market_cap_rank}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <img
                            src={coin.image}
                            alt={coin.name}
                            className="h-6 w-6 rounded-full"
                            loading="lazy"
                          />
                          <div>
                            <div className="font-medium text-sm">{coin.name}</div>
                            <div className="text-xs text-muted-foreground uppercase">
                              {coin.symbol}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatUSD(coin.current_price)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm font-medium ${changeClass}`}>
                        <span className="flex items-center justify-end gap-1">
                          <ChangeIcon className="h-3.5 w-3.5" />
                          {change >= 0 ? "+" : ""}
                          {change.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell">
                        {formatMarketCap(coin.market_cap)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground hidden lg:table-cell">
                        {formatMarketCap(coin.total_volume)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </FinancePageShell>
    </FinanceLayout>
  );
}
