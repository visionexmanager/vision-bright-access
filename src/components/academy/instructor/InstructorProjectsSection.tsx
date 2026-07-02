import { useMemo } from "react";
import { ProjectReviewPanel } from "@/components/academy/assessment/ProjectReviewPanel";
import { getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import { getProjectForLessonAny, getUnreviewedProjectSubmissions } from "@/lib/academy/assessmentLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorProjectsSectionProps {
  courses: AcademyCourseRow[];
  reviewerUserId: string;
  refreshKey: number;
  onReviewed: () => void;
}

export function InstructorProjectsSection({ courses, reviewerUserId, refreshKey, onReviewed }: InstructorProjectsSectionProps) {
  const items = useMemo(() => {
    const unreviewed = getUnreviewedProjectSubmissions();
    const resolved = [];
    for (const course of courses) {
      const lessons = getLessonsForCourseAny(course.id).filter((l) => l.kind === "project");
      for (const lesson of lessons) {
        const project = getProjectForLessonAny(lesson.id);
        if (!project) continue;
        const submissions = unreviewed.filter((s) => s.project_id === project.id);
        submissions.forEach((submission) => resolved.push({ submission, project, courseTitle: course.title }));
      }
    }
    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, refreshKey]);

  return <ProjectReviewPanel items={items} reviewerUserId={reviewerUserId} onReviewed={onReviewed} />;
}
