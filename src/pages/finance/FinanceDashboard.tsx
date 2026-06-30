import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Newspaper, Wallet, Eye, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Top crypto tickers for dashboard preview
const TICKER_SYMBOLS = ["bitcoin", "ethereum", "solana", "binancecoin"];

interface CoinRow {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
}

export default function FinanceDashboard() {
  const { user } = useAuth();

  const { data: cryptoData, isLoading: cryptoLoading } = useQuery<CoinRow[]>({
    queryKey: ["finance", "dashboard", "crypto"],
    queryFn: async () => {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${TICKER_SYMBOLS.join(",")}&order=market_cap_desc&sparkline=false`
      );
      if (!res.ok) throw new Error("Failed to fetch crypto");
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ["finance", "dashboard", "news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news")
        .select("id, title, description, category, published_at")
        .in("category", ["world_economy", "world_politics", "business"])
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(4);
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const CATEGORY_COLORS: Record<string, string> = {
    world_economy: "bg-emerald-500/15 text-emerald-400",
    world_politics: "bg-blue-500/15 text-blue-400",
    business: "bg-orange-500/15 text-orange-400",
  };

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Finance Dashboard"
        description="Your markets, portfolio, and watchlist at a glance."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/finance/portfolio"><Wallet className="h-3.5 w-3.5 mr-1.5" />Portfolio</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/finance/markets"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Markets</Link>
            </Button>
          </div>
        }
      >
        <div className="space-y-6">

          {/* Market Snapshot */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Market Snapshot</h2>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link to="/finance/markets">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {cryptoLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))
                : (cryptoData ?? []).map((coin) => {
                    const up = coin.price_change_percentage_24h >= 0;
                    return (
                      <Card key={coin.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase">{coin.symbol}</p>
                              <p className="text-lg font-bold mt-0.5">
                                ${coin.current_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                              </p>
                            </div>
                            {up ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                          </div>
                          <p className={`text-sm font-medium mt-1 ${up ? "text-green-500" : "text-red-500"}`}>
                            {up ? "+" : ""}{coin.price_change_percentage_24h.toFixed(2)}%
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{coin.name}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </section>

          {/* Quick Access */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "My Portfolio", desc: "Track your holdings & P&L", to: "/finance/portfolio", icon: Wallet, color: "text-blue-500 bg-blue-500/10" },
              { label: "Watchlist", desc: "Symbols you're monitoring", to: "/finance/watchlist", icon: Eye, color: "text-violet-500 bg-violet-500/10" },
              { label: "Market News", desc: "Economy & politics updates", to: "/finance/news", icon: Newspaper, color: "text-amber-500 bg-amber-500/10" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className="block group">
                  <Card className="hover:shadow-md transition-all hover:border-primary/30 group-hover:bg-muted/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${item.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </section>

          {/* Latest Financial News */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Latest News</h2>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link to="/finance/news">All news <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
            {newsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : newsData && newsData.length > 0 ? (
              <div className="space-y-2">
                {newsData.map((article: { id: string; title: string; description: string; category: string; published_at: string }) => (
                  <Card key={article.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex gap-3 items-start">
                      <Badge className={`text-[10px] shrink-0 mt-0.5 ${CATEGORY_COLORS[article.category] ?? "bg-muted"}`}>
                        {article.category.replace("world_", "").replace("_", " ")}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight line-clamp-1">{article.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{article.description}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(article.published_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No news articles yet. Check back after the daily AI news generation runs.
                </CardContent>
              </Card>
            )}
          </section>

        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
