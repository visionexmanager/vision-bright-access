import { memo } from "react";
import { Target } from "lucide-react";
import PomodoroTimer from "@/components/PomodoroTimer";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";

export const DailyLearningGoalSection = memo(function DailyLearningGoalSection() {
  return (
    <section aria-labelledby="daily-goal-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={Target}
        title="هدف اليوم الدراسي"
        description="جلسة تركيز واحدة بتقنية بومودورو تقرّبك من هدفك"
        headingId="daily-goal-heading"
      />
      <PomodoroTimer />
    </section>
  );
});
