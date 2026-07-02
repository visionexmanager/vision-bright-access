import { Badge } from "@/components/ui/badge";
import {
  FileText, Book, Tablet, Headphones, FlaskConical, Newspaper,
  Presentation, File, LayoutTemplate, PenLine, GraduationCap,
  ClipboardList, Dumbbell, StickyNote, Image,
} from "lucide-react";
import type { AcademyLibraryResourceType } from "@/lib/types/academy-modules";

const CONFIG: Record<AcademyLibraryResourceType, { label: string; icon: typeof FileText }> = {
  pdf: { label: "PDF", icon: FileText },
  book: { label: "كتاب", icon: Book },
  ebook: { label: "كتاب إلكتروني", icon: Tablet },
  audiobook: { label: "كتاب صوتي", icon: Headphones },
  research_paper: { label: "بحث علمي", icon: FlaskConical },
  scientific_article: { label: "مقالة علمية", icon: Newspaper },
  presentation: { label: "عرض تقديمي", icon: Presentation },
  document: { label: "مستند", icon: File },
  template: { label: "قالب تعليمي", icon: LayoutTemplate },
  worksheet: { label: "ورقة عمل", icon: PenLine },
  study_guide: { label: "دليل دراسي", icon: GraduationCap },
  exam_collection: { label: "مجموعة امتحانات", icon: ClipboardList },
  practice_material: { label: "مواد تدريبية", icon: Dumbbell },
  cheat_sheet: { label: "ورقة مرجعية", icon: StickyNote },
  infographic: { label: "إنفوجرافيك", icon: Image },
};

export function ResourceTypeBadge({ type }: { type: AcademyLibraryResourceType }) {
  const { label, icon: Icon } = CONFIG[type];
  return (
    <Badge variant="secondary" className="gap-1 font-medium">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
