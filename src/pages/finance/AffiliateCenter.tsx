import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Link2, Users, DollarSign, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const HOW_IT_WORKS = [
  { icon: Link2,      step: "1", title: "Get your link",     desc: "Once enrolled, you receive a unique referral link for each partner broker." },
  { icon: Users,      step: "2", title: "Share & refer",     desc: "Share your link on social media, YouTube, blogs, or with your network." },
  { icon: CheckCircle2, step: "3", title: "User registers", desc: "A user clicks your link and opens a live trading account with the broker." },
  { icon: DollarSign, step: "4", title: "Earn commission",   desc: "You earn a commission once the referred user makes their first deposit." },
];

const TIERS = [
  { name: "Starter",   refs: "0–9",  cpa: "$50",  rev: "15%", color: "bg-muted" },
  { name: "Growth",    refs: "10–49", cpa: "$80",  rev: "20%", color: "bg-blue-500/10 dark:bg-blue-500/20" },
  { name: "Pro",       refs: "50–99", cpa: "$120", rev: "25%", color: "bg-violet-500/10 dark:bg-violet-500/20" },
  { name: "Elite",     refs: "100+",  cpa: "$200", rev: "35%", color: "bg-amber-500/10 dark:bg-amber-500/20" },
];

export default function AffiliateCenter() {
  const { user } = useAuth();

  return (
    <FinanceLayout>
      <FinancePageShell
        title="Affiliate Center"
        description="Earn commissions by referring traders to Visionex partner brokers. No cap on earnings."
        actions={
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3 w-3" /> Launching Q3 2026
          </Badge>
        }
      >
        <div className="space-y-6">
          {/* How it works */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {HOW_IT_WORKS.map((step) => {
                const Icon = step.icon;
                return (
                  <Card key={step.step}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{step.step}</div>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Commission tiers */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Commission tiers</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TIERS.map((tier) => (
                <Card key={tier.name} className={tier.color}>
                  <CardContent className="p-4 space-y-2">
                    <p className="font-bold text-sm">{tier.name}</p>
                    <p className="text-xs text-muted-foreground">{tier.refs} referrals/mo</p>
                    <div className="pt-1 space-y-1">
                      <p className="text-xs"><span className="font-semibold text-foreground">{tier.cpa}</span> <span className="text-muted-foreground">CPA per signup</span></p>
                      <p className="text-xs"><span className="font-semibold text-foreground">{tier.rev}</span> <span className="text-muted-foreground">Revenue share</span></p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* CTA */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold">Ready to start earning?</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {user
                    ? "The affiliate enrollment portal opens in Q3 2026. You'll receive a notification when it launches."
                    : "Sign in to register your interest and be notified when the affiliate program launches."}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs border-primary/30 text-primary">Launching Q3 2026</Badge>
            </CardContent>
          </Card>

          <p className="text-[11px] text-muted-foreground text-center">
            Commission rates and terms are subject to change. Partner broker approval required. Not available in all regions.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
