import { useMemo } from "react";
import { Video, Youtube, FileText, Music, Presentation, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";
import type { AcademyLessonRow } from "@/lib/types/academy-lms";

interface InstructorMediaSectionProps {
  courses: AcademyCourseRow[];
}

interface MediaItem {
  lesson: AcademyLessonRow;
  courseTitle: string;
  kindLabel: string;
  icon: typeof Video;
  url: string;
}

const KIND_META: Partial<Record<AcademyLessonRow["kind"], { label: string; icon: typeof Video }>> = {
  video: { label: "فيديو", icon: Video },
  youtube: { label: "يوتيوب", icon: Youtube },
  pdf: { label: "PDF", icon: FileText },
  presentation: { label: "عرض تقديمي", icon: Presentation },
  audio: { label: "صوتي", icon: Music },
};

/** Real listing of every lesson media reference across the instructor's courses (no upload pipeline exists yet — Phase 3/4 explicitly scoped out video hosting, so this shows what's already linked rather than fabricating a media library). */
export function InstructorMediaSection({ courses }: InstructorMediaSectionProps) {
  const items = useMemo<MediaItem[]>(() => {
    const all: MediaItem[] = [];
    for (const course of courses) {
      for (const lesson of getLessonsForCourseAny(course.id)) {
        const meta = KIND_META[lesson.kind];
        if (!meta) continue;
        const url = lesson.kind === "youtube"
          ? (lesson.youtube_video_id ? `https://youtube.com/watch?v=${lesson.youtube_video_id}` : "")
          : lesson.kind === "video" ? (lesson.video_url ?? "") : (lesson.file_url ?? "");
        if (!url) continue;
        all.push({ lesson, courseTitle: course.title, kindLabel: meta.label, icon: meta.icon, url });
      }
    }
    return all;
  }, [courses]);

  if (courses.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl space-y-3">
        <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground text-sm">أنشئ دورة أولاً لإدارة وسائطها هنا.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        كل الوسائط المرتبطة بدروس دوراتك — <span className="font-bold text-foreground">{items.length}</span> عنصر.
        رفع الملفات المباشر غير متاح بعد؛ هذه روابط مضافة يدوياً عبر منشئ الدروس.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground p-4 rounded-2xl border-2 border-dashed border-border text-center">لا توجد وسائط مرتبطة بعد.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="قائمة الوسائط">
          {items.map(({ lesson, courseTitle, kindLabel, icon: Icon, url }) => (
            <li key={lesson.id} className="flex items-start gap-3 p-4 rounded-2xl border border-border bg-card">
              <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0" aria-hidden="true"><Icon className="w-4 h-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{lesson.title}</p>
                <p className="text-xs text-muted-foreground truncate">{courseTitle}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="secondary" className="text-[10px]">{kindLabel}</Badge>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    فتح الرابط
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
