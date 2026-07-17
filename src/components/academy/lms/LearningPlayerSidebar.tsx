import { Link } from "react-router-dom";
import {
  PlayCircle, FileText, Youtube, HelpCircle, ClipboardList, Rocket, CheckCircle2,
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

interface LearningPlayerSidebarProps {
  courseId: string;
  courseTitle: string;
  modules: AcademyCourseModuleRow[];
  lessonsByModule: Record<string, AcademyLessonRow[]>;
  currentLessonId: string;
  completedLessonIds: Set<string>;
}

export function LearningPlayerSidebar({
  courseId,
  courseTitle,
  modules,
  lessonsByModule,
  currentLessonId,
  completedLessonIds,
}: LearningPlayerSidebarProps) {
  return (
    <nav aria-label={`محتوى دورة ${courseTitle}`} className="bg-card rounded-3xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <p className="font-bold text-foreground text-sm truncate">{courseTitle}</p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-2">
        {modules.map((module) => (
          <div key={module.id} className="mb-2">
            <p className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">{module.title}</p>
            <ul>
              {(lessonsByModule[module.id] ?? []).map((lesson) => {
                const Icon = KIND_ICON[lesson.kind];
                const isCurrent = lesson.id === currentLessonId;
                const isCompleted = completedLessonIds.has(lesson.id);
                return (
                  <li key={lesson.id}>
                    <Link
                      to={`/academy/courses/${courseId}/learn/${lesson.id}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isCurrent ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
                      ) : (
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      )}
                      <span className="flex-1 truncate">{lesson.title}</span>
                      {isCompleted && <span className="sr-only">(مكتمل)</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
