import { memo } from "react";
import { History, MessageSquare, Clock } from "lucide-react";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";
import { useLanguage } from "@/contexts/LanguageContext";

interface RecentActivitySectionProps {
  lastActiveLabel: string | null;
  messageCount: number;
}

export const RecentActivitySection = memo(function RecentActivitySection({
  lastActiveLabel,
  messageCount,
}: RecentActivitySectionProps) {
  const { lang, t } = useLanguage();
  const hasActivity = messageCount > 0;

  return (
    <section aria-labelledby="recent-activity-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={History}
        title={t("academy.ui.recentTitle")}
        description={t("academy.ui.recentDesc")}
        headingId="recent-activity-heading"
      />

      {hasActivity ? (
        <ul className="space-y-3">
          <li className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0" aria-hidden="true">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-sm text-foreground">
              {t("academy.ui.youSent")} <span className="font-bold">{messageCount}</span> {t("academy.ui.messagesToMunir")}
            </p>
          </li>
          {lastActiveLabel && (
            <li className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0" aria-hidden="true">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-sm text-foreground">
                {t("academy.ui.lastActivity")} <span className="font-bold">{lastActiveLabel}</span>
              </p>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm py-6 text-center border-2 border-dashed border-border rounded-2xl">
          {t("academy.ui.recentEmpty")}
        </p>
      )}
    </section>
  );
});
