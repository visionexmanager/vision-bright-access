import { Send, MessageSquare, Trophy, Sparkles, Award, Milestone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_JOURNAL, WEEKLY_REVIEW } from "../mock/mockJournal";
import type { JournalEntryKind } from "../types";

const KIND_ICON: Record<JournalEntryKind, LucideIcon> = {
  application: Send,
  interview: MessageSquare,
  achievement: Trophy,
  skill: Sparkles,
  certificate: Award,
  milestone: Milestone,
};

export function CareerJournal() {
  const { t } = useLanguage();
  const sorted = [...MOCK_JOURNAL].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.journal")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.journal.subtitle")}</p>
      </div>

      <div className="agent-glass rounded-2xl border-primary/20 p-5">
        <p className="mb-2 text-sm font-bold">{t("agentUI.journal.weeklyReview")}</p>
        <div className="mb-3 grid grid-cols-3 gap-3 text-center">
          <div><p className="text-xl font-black text-primary">{WEEKLY_REVIEW.applicationsSent}</p><p className="text-xs text-muted-foreground">{t("agentUI.journal.applicationsSent")}</p></div>
          <div><p className="text-xl font-black text-primary">{WEEKLY_REVIEW.interviewsCompleted}</p><p className="text-xs text-muted-foreground">{t("agentUI.journal.interviewsCompleted")}</p></div>
          <div><p className="text-xl font-black text-primary">{WEEKLY_REVIEW.skillsLearned}</p><p className="text-xs text-muted-foreground">{t("agentUI.journal.skillsLearned")}</p></div>
        </div>
        <p className="text-sm text-muted-foreground">{WEEKLY_REVIEW.summary}</p>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-4 text-sm font-bold">{t("agentUI.journal.timeline")}</p>
        <ol className="flex flex-col gap-4">
          {sorted.map((entry, i) => {
            const Icon = KIND_ICON[entry.kind];
            return (
              <li key={entry.id} className="relative flex gap-3 ps-1">
                {i < sorted.length - 1 && <span className="absolute start-[15px] top-8 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden="true" />}
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="pb-1">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">{entry.date}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
