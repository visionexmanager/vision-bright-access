import { useState } from "react";
import { CheckSquare, Square, Building2, Shirt, Video, Heart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { MOCK_COMPANY_PROFILE } from "@/components/career/employer/mock/mockCompany";
import { INTERVIEW_CHECKLIST, INTERVIEW_QUESTIONS, DRESS_TIPS, MEETING_TIPS, CONFIDENCE_TIPS } from "../mock/mockInterviewPrep";
import type { InterviewPrepQuestion } from "../types";

function TipCard({ icon: Icon, title, tips }: { icon: typeof Shirt; title: string; tips: string[] }) {
  return (
    <div className="agent-glass rounded-2xl p-5">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Icon className="h-4 w-4 text-primary" aria-hidden="true" />{title}</p>
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {tips.map((tip) => <li key={tip}>• {tip}</li>)}
      </ul>
    </div>
  );
}

function QuestionGroup({ category, questions }: { category: string; questions: InterviewPrepQuestion[] }) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t(`agentUI.interview.category.${category}`)}</p>
      <ul className="flex flex-col gap-1.5">
        {questions.map((q) => <li key={q.id} className="rounded-xl border border-border/50 p-2.5 text-sm">{q.question}</li>)}
      </ul>
    </div>
  );
}

export function InterviewAssistant() {
  const { t } = useLanguage();
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="type-heading mb-1">{t("agentUI.nav.interview")}</h1>
        <p className="text-sm text-muted-foreground">{t("agentUI.interview.subtitle")}</p>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-3 text-sm font-bold">{t("agentUI.interview.checklist")}</p>
        <ul className="flex flex-col gap-1.5">
          {INTERVIEW_CHECKLIST.map((item, i) => (
            <li key={item}>
              <button type="button" onClick={() => toggle(i)} aria-pressed={checked.has(i)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {checked.has(i) ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Square className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className={checked.has(i) ? "text-muted-foreground line-through" : ""}>{item}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="agent-glass rounded-2xl p-5">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><Building2 className="h-4 w-4 text-primary" aria-hidden="true" />{t("agentUI.interview.companySummary")}</p>
        <p className="text-sm text-muted-foreground">{MOCK_COMPANY_PROFILE.description}</p>
        <p className="mt-1 text-xs text-muted-foreground">{MOCK_COMPANY_PROFILE.industry} · {MOCK_COMPANY_PROFILE.size}</p>
      </div>

      <div className="agent-glass grid gap-4 rounded-2xl p-5 sm:grid-cols-3">
        <QuestionGroup category="common" questions={INTERVIEW_QUESTIONS.filter((q) => q.category === "common")} />
        <QuestionGroup category="technical" questions={INTERVIEW_QUESTIONS.filter((q) => q.category === "technical")} />
        <QuestionGroup category="behavioral" questions={INTERVIEW_QUESTIONS.filter((q) => q.category === "behavioral")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TipCard icon={Shirt} title={t("agentUI.interview.dressTips")} tips={DRESS_TIPS} />
        <TipCard icon={Video} title={t("agentUI.interview.meetingTips")} tips={MEETING_TIPS} />
        <TipCard icon={Heart} title={t("agentUI.interview.confidenceTips")} tips={CONFIDENCE_TIPS} />
      </div>
    </div>
  );
}
