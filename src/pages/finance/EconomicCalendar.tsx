import { useNavigate } from "react-router-dom";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar } from "lucide-react";

const EVENTS = [
  { date: "Jul 2",  time: "14:00 UTC", country: "🇺🇸", event: "ADP Non-Farm Employment",  impact: "high",   forecast: "150K",   prev: "152K" },
  { date: "Jul 3",  time: "12:30 UTC", country: "🇺🇸", event: "Initial Jobless Claims",    impact: "medium", forecast: "235K",   prev: "233K" },
  { date: "Jul 4",  time: "12:30 UTC", country: "🇺🇸", event: "Non-Farm Payrolls (NFP)",   impact: "high",   forecast: "185K",   prev: "139K" },
  { date: "Jul 8",  time: "17:00 UTC", country: "🇺🇸", event: "Fed Meeting Minutes",       impact: "high",   forecast: "—",      prev: "—" },
  { date: "Jul 10", time: "12:30 UTC", country: "🇺🇸", event: "CPI (MoM)",                impact: "high",   forecast: "0.3%",   prev: "0.2%" },
  { date: "Jul 10", time: "12:30 UTC", country: "🇺🇸", event: "Core CPI (YoY)",           impact: "high",   forecast: "3.3%",   prev: "3.4%" },
  { date: "Jul 11", time: "12:30 UTC", country: "🇺🇸", event: "PPI (MoM)",                impact: "medium", forecast: "0.2%",   prev: "0.1%" },
  { date: "Jul 15", time: "09:00 UTC", country: "🇨🇳", event: "GDP Growth Rate (Q2)",     impact: "high",   forecast: "5.0%",   prev: "5.3%" },
  { date: "Jul 17", time: "11:00 UTC", country: "🇬🇧", event: "UK CPI (YoY)",             impact: "high",   forecast: "2.1%",   prev: "2.3%" },
  { date: "Jul 24", time: "09:00 UTC", country: "🇪🇺", event: "ECB Interest Rate Decision",impact: "high",  forecast: "3.40%",  prev: "3.65%" },
  { date: "Jul 30", time: "18:00 UTC", country: "🇺🇸", event: "FOMC Interest Rate Decision",impact: "high", forecast: "4.25%",  prev: "4.25%" },
  { date: "Jul 30", time: "12:30 UTC", country: "🇺🇸", event: "US GDP Growth Rate (Q2 prel.)",impact:"high",forecast:"2.4%",  prev: "2.8%" },
];

const IMPACT_COLOR: Record<string, string> = {
  high:   "bg-red-500/15 text-red-500 border-red-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low:    "bg-green-500/15 text-green-500 border-green-500/30",
};

export default function EconomicCalendar() {
  const navigate = useNavigate();

  const askAI = (event: string, date: string) => {
    const ctx = encodeURIComponent(
      `Explain the upcoming economic event: "${event}" on ${date}. What does this indicator measure? What is the market expecting and why? How could it affect USD, equities, and crypto markets if the result is above or below forecast?`
    );
    navigate(`/finance/ai-analyst?ctx=${ctx}`);
  };

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Economic Calendar"
        description="Upcoming high-impact economic events and key data releases. Click any event to get an AI explanation."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            July 2026 · UTC times
          </div>
        }
      >
        <div className="space-y-2">
          {EVENTS.map((ev, i) => (
            <Card key={i} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-xs text-muted-foreground w-16 shrink-0">
                    <p className="font-medium text-foreground">{ev.date}</p>
                    <p>{ev.time}</p>
                  </div>
                  <span className="text-base">{ev.country}</span>
                  <Badge variant="outline" className={`text-[10px] shrink-0 border ${IMPACT_COLOR[ev.impact]}`}>
                    {ev.impact}
                  </Badge>
                  <p className="flex-1 text-sm font-medium min-w-0">{ev.event}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground shrink-0">
                    <span>Fcst: <b className="text-foreground">{ev.forecast}</b></span>
                    <span>Prev: {ev.prev}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 text-primary shrink-0"
                    onClick={() => askAI(ev.event, ev.date)}
                  >
                    <Sparkles className="h-3 w-3" />Ask AI
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Forecasts are estimates. Actual results may differ. Not financial advice.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
