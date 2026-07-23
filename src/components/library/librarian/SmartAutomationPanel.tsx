import { Link } from "react-router-dom";
import { Zap, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLibrarianAutomation } from "@/hooks/library/useLibrarianAutomation";
import { useLanguage } from "@/contexts/LanguageContext";

const ACTION_LABEL_KEYS: Record<string, string> = {
  "resume-reading": "library.librarian.automation.action.resumeReading",
  "next-chapter": "library.librarian.automation.action.nextChapter",
  "review-session": "library.librarian.automation.action.reviewSession",
  "fatigue-break": "library.librarian.automation.action.takeBreak",
  "recommend-challenge": "library.librarian.automation.action.viewChallenge",
};

export function SmartAutomationPanel() {
  const { t } = useLanguage();
  const { suggestions } = useLibrarianAutomation();

  if (suggestions.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Zap className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.automation.title")}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {suggestions.map((s) => {
          let message = t(`library.librarian.automation.message.${s.id}`);
          for (const [key, value] of Object.entries(s.values)) message = message.replace(`{${key}}`, String(value));
          return (
            <Card key={s.id} className="flex items-center justify-between gap-2 p-3">
              <p className="text-sm">{message}</p>
              <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1">
                <Link to={s.actionTo}>{t(ACTION_LABEL_KEYS[s.id])} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
