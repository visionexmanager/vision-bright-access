import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AchievementCard } from "./AchievementCard";
import type { AcademyAchievementCategory, AcademyAchievementDef } from "@/lib/types/academy-gamification";

interface AchievementGalleryProps {
  achievements: AcademyAchievementDef[];
  unlockedIds: Set<string>;
}

const CATEGORY_LABELS: Record<AcademyAchievementCategory, string> = {
  learning: "التعلّم",
  courses: "الدورات",
  projects: "المشاريع",
  certificates: "الشهادات",
  community: "المجتمع",
  reading: "القراءة",
  consistency: "الانتظام",
  milestones: "المحطات",
  instructor: "التدريس",
  special_events: "فعاليات خاصة",
};

export function AchievementGallery({ achievements, unlockedIds }: AchievementGalleryProps) {
  const categories = useMemo(
    () => Array.from(new Set(achievements.map((a) => a.category))) as AcademyAchievementCategory[],
    [achievements]
  );
  const [tab, setTab] = useState<"all" | AcademyAchievementCategory>("all");

  const filtered = tab === "all" ? achievements : achievements.filter((a) => a.category === tab);
  const unlockedCount = achievements.filter((a) => unlockedIds.has(a.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">الكل</TabsTrigger>
            {categories.map((c) => (
              <TabsTrigger key={c} value={c}>{CATEGORY_LABELS[c]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <span className="text-xs font-bold text-muted-foreground shrink-0">{unlockedCount} / {achievements.length} مُنجَز</span>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="قائمة الإنجازات">
        {filtered.map((a) => (
          <li key={a.id}>
            <AchievementCard achievement={a} unlocked={unlockedIds.has(a.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
