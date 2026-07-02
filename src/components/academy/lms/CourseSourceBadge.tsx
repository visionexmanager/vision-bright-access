import { Badge } from "@/components/ui/badge";
import { Building2, Store, Youtube, Sparkles } from "lucide-react";
import type { AcademyCourseSource } from "@/lib/types/academy-modules";

const CONFIG: Record<AcademyCourseSource, { label: string; icon: typeof Building2 }> = {
  visionex: { label: "Visionex الأصلية", icon: Building2 },
  marketplace: { label: "سوق المدرّسين", icon: Store },
  youtube: { label: "يوتيوب تعليمي", icon: Youtube },
  ai: { label: "مسار بالذكاء الاصطناعي", icon: Sparkles },
};

export function CourseSourceBadge({ source }: { source: AcademyCourseSource }) {
  const { label, icon: Icon } = CONFIG[source];
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
