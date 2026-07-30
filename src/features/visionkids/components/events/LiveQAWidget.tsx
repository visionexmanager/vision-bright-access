import { useState } from "react";
import { HelpCircle, ThumbsUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEventQuestions, useAskQuestion, useUpvoteQuestion } from "@/features/visionkids/hooks/events/useLiveFeatures";

export function LiveQAWidget({ eventId }: { eventId: string }) {
  const { t } = useLanguage();
  const { data: questions = [] } = useEventQuestions(eventId);
  const askQuestion = useAskQuestion(eventId);
  const upvote = useUpvoteQuestion(eventId);
  const [draft, setDraft] = useState("");

  const handleAsk = () => {
    const text = draft.trim();
    if (!text) return;
    askQuestion.mutate(text);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAsk()} placeholder={t("kids.events.live.askAQuestion")} maxLength={280} />
        <Button size="icon" onClick={handleAsk} disabled={!draft.trim() || askQuestion.isPending} aria-label={t("kids.events.live.askAQuestion")}>
          <Send className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {questions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("kids.events.live.noQuestionsYet")}</p>}
        {questions.map((q) => (
          <div key={q.id} className={`rounded-xl border-2 p-3 ${q.is_answered ? "border-kids-green/40 bg-kids-green/10" : "border-border bg-card"}`}>
            <p className="flex items-start gap-2 text-sm font-semibold"><HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-kids-primary" aria-hidden="true" /> {q.question}</p>
            {q.is_answered && q.answer_text && <p className="mt-1 ps-6 text-sm text-muted-foreground">{q.answer_text}</p>}
            <div className="mt-2 ps-6">
              <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => upvote.mutate(q.id)}>
                <ThumbsUp className="h-3 w-3" aria-hidden="true" /> {q.upvote_count}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
