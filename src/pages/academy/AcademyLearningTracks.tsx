import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Route, ArrowLeft, Clock, BadgeCheck, Lock } from "lucide-react";
import { DifficultyBadge } from "@/components/academy/lms/DifficultyBadge";
import { AcademySectionHeader } from "@/components/academy/ui/AcademySectionHeader";
import { useLearningTracks } from "@/hooks/academy/useLearningTracks";
import { useMyEnrollments } from "@/hooks/academy/useEnrollment";
import { fetchCourseById } from "@/services/academy/lms";
import type { AcademyLearningTrackRow } from "@/lib/types/academy-lms";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

function useTrackProgress(track: AcademyLearningTrackRow, completedCourseIds: Set<string>) {
  return useMemo(() => {
    if (track.course_ids.length === 0) return 0;
    const completedCourses = track.course_ids.filter((courseId) => completedCourseIds.has(courseId));
    return Math.round((completedCourses.length / track.course_ids.length) * 100);
  }, [track, completedCourseIds]);
}

function TrackCard({ track, completedCourseIds }: { track: AcademyLearningTrackRow; completedCourseIds: Set<string> }) {
  const progressPercent = useTrackProgress(track, completedCourseIds);
  const hours = Math.round((track.estimated_duration_minutes / 60) * 10) / 10;
  const [courses, setCourses] = useState<AcademyCourseRow[]>([]);

  useEffect(() => {
    Promise.all(track.course_ids.map((id) => fetchCourseById(id))).then((results) => {
      setCourses(results.filter((c): c is AcademyCourseRow => c !== null));
    });
  }, [track.course_ids]);

  return (
    <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <DifficultyBadge difficulty={track.difficulty} />
          <h3 className="text-lg font-black text-foreground mt-2">{track.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{track.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {track.skills.map((skill) => (
          <Badge key={skill} variant="secondary">{skill}</Badge>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" aria-hidden="true" />{hours} ساعة تقريباً</span>
        <span className="flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          شهادة عند الإكمال (قريباً)
        </span>
      </div>

      <div className="space-y-1.5" aria-label={`تقدّمك في المسار: ${progressPercent}%`}>
        <Progress value={progressPercent} className="h-2" />
        <p className="text-xs text-muted-foreground">{progressPercent}% مكتمل</p>
      </div>

      <ul className="space-y-1.5">
        {courses.map((course) => course && (
          <li key={course.id}>
            <Link
              to={`/academy/courses/${course.id}`}
              className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <BadgeCheck className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              {course.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AcademyLearningTracks() {
  const { tracks } = useLearningTracks();
  const { enrollments } = useMyEnrollments();
  const completedCourseIds = useMemo(
    () => new Set(enrollments.filter((e) => e.completed_at).map((e) => e.course_id)),
    [enrollments]
  );

  return (
    <Layout>
      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 font-sans text-start">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 gap-1 rounded-xl">
            <Link to="/academy">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              العودة إلى الأكاديمية
            </Link>
          </Button>
          <AcademySectionHeader
            icon={Route}
            title="مسارات التعلّم"
            description="اختر مساراً متكاملاً يناسب مستواك: مبتدئ، متوسط، أو متقدّم"
            headingId="tracks-heading"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tracks.map((track) => <TrackCard key={track.id} track={track} completedCourseIds={completedCourseIds} />)}
        </div>
      </div>
    </Layout>
  );
}
