import { memo } from "react";
import { PlayCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";
import { useLanguage } from "@/contexts/LanguageContext";

interface ContinueLearningSectionProps {
  hasChatActivity: boolean;
  messageCount: number;
  onOpenAILearning: () => void;
}

export const ContinueLearningSection = memo(function ContinueLearningSection({
  hasChatActivity,
  messageCount,
  onOpenAILearning,
}: ContinueLearningSectionProps) {
  const { lang } = useLanguage();
  const text = (english: string, arabic: string) => lang === "ar" ? arabic : english;
  return (
    <section aria-labelledby="continue-learning-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={PlayCircle}
        title={text("Continue Learning", "متابعة التعلم")}
        description={hasChatActivity ? text("Resume where you left off", "استكمل من حيث توقفت") : text("You haven't started your journey yet", "لم تبدأ رحلتك بعد")}
        headingId="continue-learning-heading"
      />

      {hasChatActivity ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-muted/50 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0" aria-hidden="true">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-foreground">{text("Your conversation with Munir", "محادثتك مع منير")}</p>
              <p className="text-sm text-muted-foreground">{text(`${messageCount} messages so far`, `${messageCount} رسالة حتى الآن`)}</p>
            </div>
          </div>
          <Button onClick={onOpenAILearning} className="rounded-xl gap-2 shrink-0">
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            {text("Continue Conversation", "متابعة المحادثة")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 border-dashed border-border">
          <p className="text-muted-foreground text-sm">
            {text("You haven't started yet! Ask Munir about your studies or career to begin your learning journey.", "لسه ما بدأت! اسأل منير عن دروسك أو مستقبلك المهني لتبدأ رحلتك التعليمية.")}
          </p>
          <Button onClick={onOpenAILearning} variant="outline" className="rounded-xl gap-2 shrink-0">
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            {text("Get Started", "ابدأ الآن")}
          </Button>
        </div>
      )}
    </section>
  );
});
