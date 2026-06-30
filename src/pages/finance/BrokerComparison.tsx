import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

const BROKERS = [
  {
    name: "Interactive Brokers", founded: "1978",
    regulation: ["SEC", "FINRA", "FCA", "MAS"],
    minDeposit: "$0", spread: "From 0.1 pip", forexPairs: "100+",
    crypto: true, stocks: true,
    verdict: "Best for professionals & global markets",
    colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    name: "eToro", founded: "2007",
    regulation: ["FCA", "CySEC", "ASIC"],
    minDeposit: "$50", spread: "From 1 pip", forexPairs: "49",
    crypto: true, stocks: true,
    verdict: "Best for social copy trading",
    colorClass: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    name: "XM Group", founded: "2009",
    regulation: ["CySEC", "ASIC", "DFSA", "FSC"],
    minDeposit: "$5", spread: "From 0.6 pip", forexPairs: "55+",
    crypto: true, stocks: true,
    verdict: "Best for low minimum deposit",
    colorClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    name: "Saxo Bank", founded: "1992",
    regulation: ["FSA (DK)", "FCA", "MAS", "ASIC"],
    minDeposit: "$2,000", spread: "From 0.4 pip", forexPairs: "185+",
    crypto: false, stocks: true,
    verdict: "Best for advanced traders & forex range",
    colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    name: "IG Group", founded: "1974",
    regulation: ["FCA", "ASIC", "MAS", "BaFin"],
    minDeposit: "$0", spread: "From 0.6 pip", forexPairs: "80+",
    crypto: true, stocks: true,
    verdict: "Best for established reputation & education",
    colorClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  },
];

function TF({ val }: { val: boolean }) {
  return val
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : <XCircle className="h-4 w-4 text-muted-foreground/30" />;
}

export default function BrokerComparison() {
  return (
    <FinanceLayout>
      <FinancePageShell
        title="Broker Comparison"
        description="Top regulated brokers compared by fees, platforms, and trading conditions. Always verify directly with each broker before opening an account."
      >
        <div className="space-y-3">
          {BROKERS.map((b) => (
            <Card key={b.name} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  <div className={`p-4 sm:w-52 shrink-0 flex flex-col justify-center gap-1 ${b.colorClass}`}>
                    <p className="font-bold text-sm">{b.name}</p>
                    <p className="text-xs opacity-70">Est. {b.founded}</p>
                    <p className="text-[11px] font-medium mt-1 opacity-90 leading-snug">{b.verdict}</p>
                  </div>
                  <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Min Deposit</p>
                      <p className="font-semibold text-xs">{b.minDeposit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Spread</p>
                      <p className="font-semibold text-xs">{b.spread}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Forex Pairs</p>
                      <p className="font-semibold text-xs">{b.forexPairs}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Crypto</p>
                      <TF val={b.crypto} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Stocks</p>
                      <TF val={b.stocks} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Regulated by</p>
                      <div className="flex flex-wrap gap-1">
                        {b.regulation.slice(0, 2).map((r) => (
                          <Badge key={r} variant="secondary" className="text-[9px] px-1 py-0">{r}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Visionex does not endorse any broker. Trading involves significant risk of loss.
          </p>
        </div>
      </FinancePageShell>
    </FinanceLayout>
  );
}
