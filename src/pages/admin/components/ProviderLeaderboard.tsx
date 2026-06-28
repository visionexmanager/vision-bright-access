import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ProviderStat {
  slug:          string;
  name:          string;
  type:          string;
  successRate:   number;
  avgLatencyMs:  number;
  requestsToday: number;
  costUsdToday:  number;
  healthScore:   number;
  trend:         "up" | "down" | "stable";
}

const MOCK_PROVIDERS: ProviderStat[] = [
  { slug: "elevenlabs",    name: "ElevenLabs",       type: "TTS",   successRate: 99.7, avgLatencyMs: 340,  requestsToday: 84_320, costUsdToday: 126.48, healthScore: 99, trend: "stable" },
  { slug: "openai-tts",   name: "OpenAI TTS",        type: "TTS",   successRate: 99.2, avgLatencyMs: 410,  requestsToday: 31_040, costUsdToday: 93.12,  healthScore: 97, trend: "up"     },
  { slug: "murf",         name: "Murf AI",            type: "TTS",   successRate: 97.8, avgLatencyMs: 520,  requestsToday: 12_100, costUsdToday: 48.40,  healthScore: 92, trend: "stable" },
  { slug: "luma",         name: "Luma Dream Machine", type: "Video", successRate: 94.1, avgLatencyMs: 8_400,requestsToday: 2_840,  costUsdToday: 284.00, healthScore: 78, trend: "down"   },
  { slug: "runway",       name: "RunwayML",           type: "Video", successRate: 98.4, avgLatencyMs: 6_100,requestsToday: 1_230,  costUsdToday: 184.50, healthScore: 95, trend: "stable" },
  { slug: "resemble",     name: "Resemble AI",        type: "Clone", successRate: 96.2, avgLatencyMs: 12_000,requestsToday: 420,  costUsdToday: 210.00, healthScore: 88, trend: "stable" },
];

const TREND_ICON = {
  up:     <TrendingUp   className="size-3.5 text-green-400" />,
  down:   <TrendingDown className="size-3.5 text-red-400" />,
  stable: <Minus        className="size-3.5 text-muted-foreground" />,
};

function HealthBar({ score }: { score: number }) {
  const color = score >= 95 ? "bg-green-500" : score >= 80 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono w-8 text-right">{score}</span>
    </div>
  );
}

export function ProviderLeaderboard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">Provider Leaderboard</p>
        <p className="text-[10px] text-muted-foreground">Ranked by health score · 24h window</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-4 py-2">Provider</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-right px-4 py-2">Success</th>
              <th className="text-right px-4 py-2">Latency</th>
              <th className="text-right px-4 py-2">Requests</th>
              <th className="text-right px-4 py-2">Cost</th>
              <th className="px-4 py-2 w-28">Health</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {MOCK_PROVIDERS.sort((a, b) => b.healthScore - a.healthScore).map((p, i) => (
              <tr key={p.slug} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px]">
                    {p.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className={cn("font-mono", p.successRate < 97 ? "text-yellow-400" : "text-green-400")}>
                    {p.successRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {p.avgLatencyMs >= 1000
                    ? `${(p.avgLatencyMs / 1000).toFixed(1)}s`
                    : `${p.avgLatencyMs}ms`}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {p.requestsToday.toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-400">
                  ${p.costUsdToday.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 w-28">
                  <HealthBar score={p.healthScore} />
                </td>
                <td className="px-3 py-2.5">
                  {TREND_ICON[p.trend]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
