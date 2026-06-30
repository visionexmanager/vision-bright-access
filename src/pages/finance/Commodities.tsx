import { useNavigate } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const COMMODITIES = [
  { emoji: "🥇", name: "Gold",        symbol: "XAU/USD", desc: "Premier safe-haven asset" },
  { emoji: "🥈", name: "Silver",      symbol: "XAG/USD", desc: "Industrial + store of value" },
  { emoji: "🛢️", name: "Crude Oil",   symbol: "WTI",     desc: "Global energy benchmark" },
  { emoji: "⛽", name: "Natural Gas",  symbol: "NATGAS",  desc: "Energy & heating commodity" },
  { emoji: "🌽", name: "Corn",        symbol: "ZC",      desc: "Key agricultural commodity" },
  { emoji: "🌾", name: "Wheat",       symbol: "ZW",      desc: "Staple crop & food security" },
  { emoji: "☕", name: "Coffee",      symbol: "KC",      desc: "Soft commodity & EM export" },
  { emoji: "🍫", name: "Cocoa",       symbol: "CC",      desc: "Luxury commodity & volatility" },
  { emoji: "🔩", name: "Copper",      symbol: "HG",      desc: "Economic health indicator" },
  { emoji: "🌊", name: "Brent Crude", symbol: "BRENT",   desc: "European oil benchmark" },
];

export default function Commodities() {
  const navigate = useNavigate();

  const askAI = (name: string, symbol: string) => {
    const ctx = encodeURIComponent(
      `Analyze the commodity ${name} (${symbol}) — give me: current macro drivers, supply/demand outlook, key risk factors (geopolitical, weather, USD strength), and a bullish/bearish/neutral outlook for the next 30 days with reasoning.`
    );
    navigate(`/finance/ai-analyst?ctx=${ctx}`);
  };

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Commodities"
        description="Gold, oil, agricultural goods and industrial metals — click any commodity for AI-powered macro analysis."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {COMMODITIES.map((c) => (
              <Card key={c.symbol} className="hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group" onClick={() => askAI(c.name, c.symbol)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{c.emoji}</span>
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-primary transition-colors mt-1" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{c.symbol}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{c.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground text-center pt-2">
            Live commodity prices require a premium data subscription. AI analysis is based on macro fundamentals — not financial advice.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
