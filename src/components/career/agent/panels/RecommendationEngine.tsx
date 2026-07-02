import { Lightbulb } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MOCK_RECOMMENDATIONS } from "../mock/mockRecommendations";
import type { RecommendationKind } from "../types";

const KINDS: RecommendationKind[] = ["job", "company", "course", "certification", "skill"];

function RecommendationList({ kind }: { kind: RecommendationKind }) {
  const { t } = useLanguage();
  const items = MOCK_RECOMMENDATIONS.filter((r) => r.kind === kind);

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id} className="agent-glass flex flex-col gap-2 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{item.matchScore}%</span>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
            {item.reason}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RecommendationEngine() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.recommendations")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.recommendations.subtitle")}</p>
      </div>

      <Tabs defaultValue="job">
        <TabsList className="flex-wrap">
          {KINDS.map((kind) => <TabsTrigger key={kind} value={kind}>{t(`agentUI.recommendations.kind.${kind}`)}</TabsTrigger>)}
        </TabsList>
        {KINDS.map((kind) => (
          <TabsContent key={kind} value={kind} className="mt-4">
            <RecommendationList kind={kind} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
