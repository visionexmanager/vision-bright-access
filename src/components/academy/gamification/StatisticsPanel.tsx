import {
  Clock, BookOpenCheck, GraduationCap, Target, CheckCircle2, BookOpen, Rocket, Award, Flame,
} from "lucide-react";
import type { AcademyLearningStatistics } from "@/lib/types/academy-gamification";

interface StatisticsPanelProps {
  stats: AcademyLearningStatistics;
}

export function StatisticsPanel({ stats }: StatisticsPanelProps) {
  const items = [
    { icon: Clock, label: "ساعات التعلّم", value: `${stats.learning_hours}` },
    { icon: BookOpenCheck, label: "الدروس المكتملة", value: stats.lessons_completed },
    { icon: GraduationCap, label: "الدورات المكتملة", value: stats.courses_completed },
    { icon: Target, label: "متوسط الاختبارات", value: `${stats.average_quiz_score_percent}%` },
    { icon: CheckCircle2, label: "دقة الإجابات", value: `${stats.quiz_accuracy_percent}%` },
    { icon: BookOpen, label: "دقائق القراءة", value: stats.reading_time_minutes },
    { icon: Rocket, label: "المشاريع المسلَّمة", value: stats.projects_completed },
    { icon: Award, label: "الشهادات", value: stats.certificates_earned },
    { icon: Flame, label: "تتابع التعلّم", value: `${stats.current_streak_days} يوم` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3" role="list" aria-label="إحصائيات التعلّم">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} role="listitem" className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
          <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden="true">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-black text-foreground leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
