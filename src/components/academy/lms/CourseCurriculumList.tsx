import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  PlayCircle, FileText, Youtube, HelpCircle, ClipboardList, Rocket, Lock, CheckCircle2,
  FileType2, Presentation, FileAudio, Link2, Download, Radio, Code2, Dumbbell,
} from "lucide-react";
import type { AcademyCourseModuleRow } from "@/lib/types/academy-modules";
import type { AcademyLessonRow, AcademyLessonKind } from "@/lib/types/academy-lms";

const KIND_ICON: Record<AcademyLessonKind, typeof PlayCircle> = {
  video: PlayCircle,
  youtube: Youtube,
  text: FileText,
  quiz: HelpCircle,
  assignment: ClipboardList,
  project: Rocket,
  pdf: FileType2,
  presentation: Presentation,
  audio: FileAudio,
  external_link: Link2,
  downloads: Download,
  live_session: Radio,
  code_example: Code2,
  exercise: Dumbbell,
};

const KIND_LABEL: Record<AcademyLessonKind, string> = {
  video: "فيديو",
  youtube: "فيديو يوتيوب",
  text: "درس نصي",
  quiz: "اختبار قصير",
  assignment: "واجب",
  project: "مشروع",
  pdf: "ملف PDF",
  presentation: "عرض تقديمي",
  audio: "مقطع صوتي",
  external_link: "رابط خارجي",
  downloads: "ملفات للتحميل",
  live_session: "جلسة مباشرة",
  code_example: "مثال برمجي",
  exercise: "تمرين",
};

interface CourseCurriculumListProps {
  courseId: string;
  modules: AcademyCourseModuleRow[];
  lessonsByModule: Record<string, AcademyLessonRow[]>;
  isFreeCourse: boolean;
  completedLessonIds?: Set<string>;
}

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} د`;
}

export function CourseCurriculumList({
  courseId,
  modules,
  lessonsByModule,
  isFreeCourse,
  completedLessonIds,
}: CourseCurriculumListProps) {
  if (modules.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed border-border rounded-2xl">
        المنهج قيد الإعداد وسيتوفر قريباً.
      </p>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={[modules[0]?.id]} className="w-full">
      {modules.map((module) => {
        const lessons = lessonsByModule[module.id] ?? [];
        return (
          <AccordionItem key={module.id} value={module.id}>
            <AccordionTrigger className="text-start">
              <span className="flex flex-col items-start">
                <span className="font-bold text-foreground">{module.title}</span>
                <span className="text-xs text-muted-foreground font-normal">{lessons.length} دروس</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {lessons.map((lesson) => {
                  const Icon = KIND_ICON[lesson.kind];
                  const locked = !isFreeCourse && !lesson.is_preview;
                  const completed = completedLessonIds?.has(lesson.id);
                  return (
                    <li key={lesson.id}>
                      <Link
                        to={`/academy/courses/${courseId}/learn/${lesson.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="مكتمل" />
                        ) : (
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                        )}
                        <span className="flex-1 text-sm text-foreground">{lesson.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{KIND_LABEL[lesson.kind]}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDuration(lesson.duration_seconds)}</span>
                        {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="يتطلب الاشتراك بالدورة" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
