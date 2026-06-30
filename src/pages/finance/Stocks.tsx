import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Search, TrendingUp } from "lucide-react";

const HOT_STOCKS = [
  { ticker: "AAPL",  name: "Apple" },
  { ticker: "MSFT",  name: "Microsoft" },
  { ticker: "GOOGL", name: "Alphabet" },
  { ticker: "AMZN",  name: "Amazon" },
  { ticker: "TSLA",  name: "Tesla" },
  { ticker: "NVDA",  name: "NVIDIA" },
  { ticker: "META",  name: "Meta" },
  { ticker: "NFLX",  name: "Netflix" },
];

export default function Stocks() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const askAI = (label: string) => {
    const ctx = encodeURIComponent(
      `Analyze the stock ${label} — give me: current market sentiment, key business drivers, recent earnings context if known, competitive position, and a BUY/SELL/HOLD signal with reasoning. Note: live price data is not available; base analysis on fundamentals and known market trends.`
    );
    navigate(`/finance/ai-analyst?ctx=${ctx}`);
  };

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Stocks"
        description="AI-powered analysis for global equities. Enter any ticker or company name to get an instant signal."
      >
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <div className="flex gap-3 items-center">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Enter ticker or company — e.g. AAPL, Tesla, Samsung…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && query.trim() && askAI(query.trim())}
                  className="border-0 shadow-none focus-visible:ring-0 text-base p-0"
                />
                <Button size="sm" className="gap-1.5 shrink-0" disabled={!query.trim()} onClick={() => askAI(query.trim())}>
                  <Sparkles className="h-3.5 w-3.5" />AI Analysis
                </Button>
              </div>
            </CardContent>
          </Card>

          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Popular Stocks
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {HOT_STOCKS.map((s) => (
                <Card key={s.ticker} className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/40 group" onClick={() => askAI(`${s.ticker} (${s.name})`)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{s.name}</p>
                      <p className="font-bold font-mono text-sm">{s.ticker}</p>
                    </div>
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground text-center">
            Live stock price feeds require a premium market data subscription. AI analysis is based on publicly known fundamentals — not financial advice.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
