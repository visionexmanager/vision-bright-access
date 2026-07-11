import { Plus, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useComingSoon } from "@/components/career/useComingSoon";
import { MOCK_PORTFOLIO } from "../mock/mockPortfolio";

export function PortfolioPanel() {
  const { t } = useLanguage();
  const handleAction = useComingSoon();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="type-heading mb-1">{t("careerDash.nav.portfolio")}</h1>
          <p className="text-sm text-muted-foreground">{t("careerDash.portfolio.subtitle")}</p>
        </div>
        <Button onClick={handleAction}>
          <Plus className="me-2 h-4 w-4" aria-hidden="true" />
          {t("careerDash.portfolio.addProject")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_PORTFOLIO.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="h-28 w-full" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)` }} aria-hidden="true" />
            <div className="flex flex-1 flex-col gap-2 p-5 pt-0">
              <p className="text-sm font-bold">{item.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tag}</span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAction}
                className="mt-auto flex items-center gap-1 self-start text-xs font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {t("careerDash.portfolio.view")} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
