import { useNavigate } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

const MODULES = [
  {
    emoji: "📈", level: "Beginner", color: "bg-green-500/10 text-green-600 dark:text-green-400",
    title: "Stock Market Fundamentals",
    topics: ["What is a stock?", "Market cap & indices", "P/E ratio & valuation", "Dividends & earnings"],
  },
  {
    emoji: "💱", level: "Beginner", color: "bg-green-500/10 text-green-600 dark:text-green-400",
    title: "Forex Basics",
    topics: ["Currency pairs explained", "Pips, lots & leverage", "Bid/ask spread", "Major vs exotic pairs"],
  },
  {
    emoji: "🔮", level: "Intermediate", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Technical Analysis",
    topics: ["Support & resistance", "Moving averages (SMA/EMA)", "RSI, MACD, Bollinger Bands", "Chart patterns"],
  },
  {
    emoji: "📊", level: "Intermediate", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Fundamental Analysis",
    topics: ["Reading financial statements", "DCF valuation model", "Economic indicators", "Sector analysis"],
  },
  {
    emoji: "₿", level: "Intermediate", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Crypto & DeFi",
    topics: ["Blockchain basics", "How Bitcoin works", "DeFi protocols", "Crypto risk management"],
  },
  {
    emoji: "⚖️", level: "Intermediate", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    title: "Risk Management",
    topics: ["Position sizing", "Stop-loss strategies", "Portfolio diversification", "Risk/reward ratio"],
  },
  {
    emoji: "🏦", level: "Advanced", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    title: "Options & Derivatives",
    topics: ["Call & put options", "The Greeks (Delta, Theta)", "Covered calls", "Hedging strategies"],
  },
  {
    emoji: "🌍", level: "Advanced", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    title: "Macro Economics",
    topics: ["Fed policy & rate cycles", "Inflation & bonds", "Currency wars & trade", "Recession indicators"],
  },
];

export default function FinanceAcademy() {
  const navigate = useNavigate();

  const askAI = (title: string, topics: string[]) => {
    const ctx = encodeURIComponent(
      `I want to learn about "${title}" in finance. Please give me a structured lesson covering:\n${topics.map((t) => `• ${t}`).join("\n")}\n\nUse clear explanations, real-world examples, and highlight key formulas or ratios where relevant.`
    );
    navigate(`/finance/ai-analyst?ctx=${ctx}`);
  };

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Finance Academy"
        description="Learn trading, investing, and financial analysis — from fundamentals to advanced strategies. Click any module to start an AI-powered lesson."
      >
        <div className="space-y-5">
          {["Beginner", "Intermediate", "Advanced"].map((level) => {
            const mods = MODULES.filter((m) => m.level === level);
            return (
              <section key={level}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">{level}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {mods.map((mod) => (
                    <Card
                      key={mod.title}
                      className="hover:shadow-md transition-all hover:border-primary/30 cursor-pointer group"
                      onClick={() => askAI(mod.title, mod.topics)}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <span className="text-2xl">{mod.emoji}</span>
                          <Badge variant="secondary" className={`text-[10px] ${mod.color} border-none`}>{mod.level}</Badge>
                        </div>
                        <p className="font-semibold text-sm leading-snug">{mod.title}</p>
                        <ul className="space-y-0.5">
                          {mod.topics.map((t) => (
                            <li key={t} className="text-[11px] text-muted-foreground">• {t}</li>
                          ))}
                        </ul>
                        <div className="flex items-center gap-1 text-[11px] text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles className="h-3 w-3" /> Start AI Lesson
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="text-[11px] text-muted-foreground text-center">
            Academy content is for educational purposes only. Not financial advice.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
