import { useMemo } from "react";
import { AssignmentGradingPanel } from "@/components/academy/assessment/AssignmentGradingPanel";
import { getLessonsForCourseAny } from "@/lib/academy/instructorLocalStore";
import { getAssignmentForLessonAny, getUngradedAssignmentSubmissions } from "@/lib/academy/assessmentLocalStore";
import type { AcademyCourseRow } from "@/lib/types/academy-modules";

interface InstructorAssignmentsSectionProps {
  courses: AcademyCourseRow[];
  graderUserId: string;
  refreshKey: number;
  onGraded: () => void;
}

export function InstructorAssignmentsSection({ courses, graderUserId, refreshKey, onGraded }: InstructorAssignmentsSectionProps) {
  const items = useMemo(() => {
    const ungraded = getUngradedAssignmentSubmissions();
    const resolved = [];
    for (const course of courses) {
      const lessons = getLessonsForCourseAny(course.id).filter((l) => l.kind === "assignment");
      for (const lesson of lessons) {
        const assignment = getAssignmentForLessonAny(lesson.id);
        if (!assignment) continue;
        const submissions = ungraded.filter((s) => s.assignment_id === assignment.id);
        submissions.forEach((submission) => resolved.push({ submission, assignment, courseTitle: course.title }));
      }
    }
    return resolved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, refreshKey]);

  return <AssignmentGradingPanel items={items} graderUserId={graderUserId} onGraded={onGraded} />;
}
