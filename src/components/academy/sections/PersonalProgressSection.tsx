import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, Rocket, Star, Trophy, Target, Crown, Bell, Bookmark,
  CalendarDays, BookOpen, ClipboardList, Settings,
} from "lucide-react";
import { AcademySectionHeader } from "../ui/AcademySectionHeader";
import { LevelBadge } from "../gamification/LevelBadge";
import { getAcademyLevelInfo } from "@/lib/academy/leveling";
import type { AcademyXPLevel } from "@/lib/academy/xp";

interface PersonalProgressSectionProps {
  displayName: string;
  xpLevel: AcademyXPLevel;
  xpFromAcademy: number;
  totalPoints: number;
  userMessageCount: number;
}

export const PersonalProgressSection = memo(function PersonalProgressSection({
  displayName,
  xpLevel,
  xpFromAcademy,
  totalPoints,
  userMessageCount,
}: PersonalProgressSectionProps) {
  const levelInfo = useMemo(() => getAcademyLevelInfo(xpFromAcademy), [xpFromAcademy]);
  return (
    <section aria-labelledby="personal-progress-heading" className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={TrendingUp}
        title="تقدّمك الشخصي"
        description={`مستوى ${displayName} في رحلته التعليمية`}
        headingId="personal-progress-heading"
        action={<LevelBadge levelInfo={levelInfo} showRank />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* XP Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-8 rounded-3xl text-white shadow-2xl relative overflow-hidden">
          <Rocket className="absolute -left-4 -bottom-4 w-28 h-28 opacity-10 -rotate-12" aria-hidden="true" />
          <h3 className="text-xl font-black mb-4 tracking-tight flex items-center gap-2">
            <Star className="text-yellow-400 w-5 h-5 fill-yellow-400" aria-hidden="true" />
            مستوى {displayName}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-bold opacity-80 uppercase tracking-widest">
              <span>{xpLevel.label}</span>
              <span>{xpLevel.current} / {xpLevel.target} XP</span>
            </div>
            <div
              className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden border border-white/10"
              role="progressbar"
              aria-valuenow={xpLevel.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`التقدم نحو المستوى التالي: ${xpLevel.percent}%`}
            >
              <div className="h-full bg-yellow-400 rounded-full transition-all duration-700" style={{ width: `${xpLevel.percent}%` }} />
            </div>
          </div>
          <p className="mt-6 text-sm opacity-70 italic">
            {xpLevel.percent < 80 ? "واصل وارسل رسائل لمنير لتكسب XP!" : "أنت قريب من المستوى التالي! 🎯"}
          </p>
        </div>

        {/* Quick stats */}
        <div className="bg-muted/50 rounded-3xl p-6 border border-border space-y-3 flex flex-col justify-center">
          <h3 className="font-black text-foreground">إحصائياتك</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">رسائل مرسلة</span>
            <span className="font-bold text-foreground">{userMessageCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">XP الأكاديمية</span>
            <span className="font-bold text-primary">{xpFromAcademy.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">رصيد VX الكلي</span>
            <span className="font-bold text-emerald-600">{totalPoints.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-border">
        <Link to="/academy/achievements" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
          إنجازاتي وشاراتي
        </Link>
        <Link to="/academy/missions" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Target className="w-3.5 h-3.5" aria-hidden="true" />
          مهامي
        </Link>
        <Link to="/academy/leaderboard" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Crown className="w-3.5 h-3.5" aria-hidden="true" />
          لوحة المتصدرين
        </Link>
        <Link to="/academy/my-courses" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          دوراتي
        </Link>
        <Link to="/academy/my-work" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
          أعمالي
        </Link>
        <Link to="/academy/planner" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
          خطة الدراسة
        </Link>
        <Link to="/academy/saved" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Bookmark className="w-3.5 h-3.5" aria-hidden="true" />
          محفوظاتي
        </Link>
        <Link to="/academy/notifications" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
          الإشعارات
        </Link>
        <Link to="/academy/settings" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
          الإعدادات
        </Link>
      </div>
    </section>
  );
});
