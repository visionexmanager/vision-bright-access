import { Badge } from "@/components/ui/badge";
import { Building2, Store, Youtube, Sparkles } from "lucide-react";
import type { AcademyCourseSource } from "@/lib/types/academy-modules";
import { useLanguage } from "@/contexts/LanguageContext";

const CONFIG: Record<AcademyCourseSource, { ar: string; en: string; icon: typeof Building2 }> = {
  visionex: { ar: "Visionex الأصلية", en: "Visionex Original", icon: Building2 },
  marketplace: { ar: "سوق المدرّسين", en: "Instructor Marketplace", icon: Store },
  youtube: { ar: "يوتيوب تعليمي", en: "Educational YouTube", icon: Youtube },
  ai: { ar: "مسار بالذكاء الاصطناعي", en: "AI Learning Path", icon: Sparkles },
};

export function CourseSourceBadge({ source }: { source: AcademyCourseSource }) {
  const { lang } = useLanguage();
  const { ar, en, icon: Icon } = CONFIG[source];
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {lang === "ar" ? ar : en}
    </Badge>
  );
}
