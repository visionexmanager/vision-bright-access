import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, Users, Coins } from "lucide-react";

interface RevenueData {
  mrr:              number;
  arr:              number;
  newSubsToday:     number;
  churnedToday:     number;
  vxRevToday:       number;   // from credit purchases
  subRevToday:      number;
  totalRevToday:    number;
  trialConvRate:    number;   // %
  planDistribution: { planId: string; label: string; count: number; rev: number }[];
}

const MOCK: RevenueData = {
  mrr:              284_500,
  arr:              3_414_000,
  newSubsToday:     142,
  churnedToday:     8,
  vxRevToday:       4_820,
  subRevToday:      12_640,
  totalRevToday:    17_460,
  trialConvRate:    23.4,
  planDistribution: [
    { planId: "basic",      label: "Basic",      count: 8_420, rev: 84_116 },
    { planId: "pro",        label: "Pro",         count: 4_130, rev: 123_649 },
    { planId: "enterprise", label: "Enterprise",  count: 762,   rev: 76_135 },
    { planId: "free_trial", label: "Free Trial",  count: 21_500, rev: 0      },
  ],
};

function StatCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub?: string; icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight ? "border-green-500/30 bg-green-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2", highlight ? "bg-green-500/15" : "bg-muted")}>
          <Icon className={cn("size-4", highlight ? "text-green-400" : "text-muted-foreground")} />
        </div>
      </div>
    </div>
  );
}

const PLAN_COLORS: Record<string, string> = {
  basic:      "bg-blue-500",
  pro:        "bg-violet-500",
  enterprise: "bg-amber-500",
  free_trial: "bg-slate-500",
};

export function RevenueAnalytics() {
  const d = MOCK;
  const totalSubs = d.planDistribution.reduce((s, p) => s + p.count, 0);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="MRR"
          value={`$${(d.mrr / 1000).toFixed(0)}K`}
          sub={`ARR $${(d.arr / 1_000_000).toFixed(1)}M`}
          icon={DollarSign}
          highlight
        />
        <StatCard
          label="Today's Revenue"
          value={`$${d.totalRevToday.toLocaleString()}`}
          sub={`Sub $${d.subRevToday.toLocaleString()} + VX $${d.vxRevToday.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          label="New Subs Today"
          value={`+${d.newSubsToday}`}
          sub={`${d.churnedToday} churned · net +${d.newSubsToday - d.churnedToday}`}
          icon={Users}
        />
        <StatCard
          label="Trial → Paid Rate"
          value={`${d.trialConvRate}%`}
          sub="30-day rolling"
          icon={Coins}
        />
      </div>

      {/* Plan distribution */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold mb-3">Subscribers by Plan</p>
        <div className="space-y-2">
          {d.planDistribution.map((p) => {
            const pct = (p.count / totalSubs) * 100;
            return (
              <div key={p.planId} className="flex items-center gap-3">
                <span className="text-xs w-20 shrink-0">{p.label}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", PLAN_COLORS[p.planId] ?? "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono w-12 text-right">{p.count.toLocaleString()}</span>
                <span className="text-[10px] font-mono text-amber-400 w-16 text-right">
                  {p.rev > 0 ? `$${(p.rev / 1000).toFixed(0)}K` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
