import { useState } from "react";
import { DollarSign, Lightbulb, ListChecks, Scale, Wand2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { estimateSalary } from "@/components/career/jobs/salaryEstimator";
import { useAiSimulation } from "@/components/career/ai/useAiSimulation";
import { AIThinkingIndicator } from "@/components/career/ai/AIThinkingIndicator";

const STRATEGY_TIPS = [
  "Let the employer name a number first when possible.",
  "Anchor with market data, not personal need.",
  "Negotiate the full package, not just base salary.",
  "Ask for time to consider any offer — you don't have to decide on the spot.",
];

const BENEFITS = ["Remote flexibility", "Signing bonus", "Extra PTO", "Learning budget", "Equity / stock options", "Health coverage"];

function buildCounterOffer(current: string, target: string): string {
  return `Thank you for the offer. Based on my research and experience, I was hoping we could discuss a base salary closer to ${target || "[target amount]"}, up from the ${current || "[offered amount]"} proposed. I'm very excited about this role and confident we can find a number that works for both of us.`;
}

export function NegotiationAssistant() {
  const { t } = useLanguage();
  const [role, setRole] = useState("Senior Frontend Engineer");
  const [checkedBenefits, setCheckedBenefits] = useState<Set<string>>(new Set());
  const [offerA, setOfferA] = useState("");
  const [offerB, setOfferB] = useState("");
  const [currentOffer, setCurrentOffer] = useState("");
  const [targetOffer, setTargetOffer] = useState("");
  const { loading, result, run } = useAiSimulation(() => estimateSalary({ job: role, country: "United States", city: "Remote", experience: "senior" }), 1300);
  const counter = useAiSimulation(() => buildCounterOffer(currentOffer, targetOffer), 1200);

  const toggleBenefit = (b: string) => {
    setCheckedBenefits((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.negotiation")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.negotiation.subtitle")}</p>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.negotiation.salaryRec")}</p>
        <div className="mb-3 flex gap-2">
          <Input value={role} onChange={(e) => setRole(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={run} disabled={loading}>{t("agentUI.negotiation.estimate")}</Button>
        </div>
        {loading && <AIThinkingIndicator label={t("agentUI.negotiation.thinking")} />}
        {result && !loading && (
          <p className="text-lg font-black text-primary">{result.currency} {result.p25.toLocaleString()} – {result.p75.toLocaleString()}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="agent-glass rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.negotiation.strategy")}</p>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {STRATEGY_TIPS.map((tip) => <li key={tip}>• {tip}</li>)}
          </ul>
        </div>

        <div className="agent-glass rounded-2xl p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.negotiation.benefitsChecklist")}</p>
          <div className="flex flex-wrap gap-2">
            {BENEFITS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggleBenefit(b)}
                aria-pressed={checkedBenefits.has(b)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${checkedBenefits.has(b) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Scale className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.negotiation.offerComparison")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="offer-a" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.negotiation.offerA")}</Label>
            <Input id="offer-a" value={offerA} onChange={(e) => setOfferA(e.target.value)} placeholder="$110,000 + equity" />
          </div>
          <div>
            <Label htmlFor="offer-b" className="mb-1.5 block text-xs text-muted-foreground">{t("agentUI.negotiation.offerB")}</Label>
            <Input id="offer-b" value={offerB} onChange={(e) => setOfferB(e.target.value)} placeholder="$120,000, no equity" />
          </div>
        </div>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Wand2 className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.negotiation.counterOffer")}</p>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <Input value={currentOffer} onChange={(e) => setCurrentOffer(e.target.value)} placeholder={t("agentUI.negotiation.currentOffer")} />
          <Input value={targetOffer} onChange={(e) => setTargetOffer(e.target.value)} placeholder={t("agentUI.negotiation.targetOffer")} />
        </div>
        <Button size="sm" onClick={counter.run} disabled={counter.loading}>{t("agentUI.negotiation.generate")}</Button>
        {counter.loading && <AIThinkingIndicator label={t("agentUI.negotiation.thinking")} />}
        {counter.result && <p className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">{counter.result}</p>}
      </div>
    </div>
  );
}
