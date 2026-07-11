/**
 * useMyCourses — the student's enrolled courses joined with course data
 * (Phase 1 backend, powers AcademyMyCourses.tsx / AcademySaved.tsx / dashboard).
 *
 * useMyLessonWork aggregates notes/bookmarks/progress across every lesson for
 * the "My Notes" / "My Bookmarks" / study-calendar views (AcademyMyWork.tsx).
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyEnrollments, fetchCourseById } from "@/services/academy/lms";
import { fetchAllNotesForUser, fetchAllBookmarksForUser, fetchAllProgressForUser } from "@/services/academy/lms";

export function useMyCourses() {
  const { user } = useAuth();

  const enrollmentsQuery = useQuery({
    queryKey: queryKeys.academy.lms.myEnrollments(user?.id ?? ""),
    queryFn: () => fetchMyEnrollments(user!.id),
    enabled: !!user,
  });

  const courseIds = (enrollmentsQuery.data ?? []).map((e) => e.course_id);

  const coursesQuery = useQuery({
    queryKey: [...queryKeys.academy.lms.myEnrollments(user?.id ?? ""), "courses", courseIds.join(",")],
    queryFn: () => Promise.all(courseIds.map((id) => fetchCourseById(id))),
    enabled: courseIds.length > 0,
  });

  const myCourses = useMemo(() => {
    const enrollments = enrollmentsQuery.data ?? [];
    const courses = coursesQuery.data ?? [];
    return enrollments
      .map((enrollment) => ({
        enrollment,
        course: courses.find((c) => c?.id === enrollment.course_id) ?? null,
      }))
      .filter((row) => row.course !== null);
  }, [enrollmentsQuery.data, coursesQuery.data]);

  return {
    myCourses,
    isLoading: enrollmentsQuery.isLoading || coursesQuery.isLoading,
  };
}

export function useMyLessonWork() {
  const { user } = useAuth();

  const notesQuery = useQuery({
    queryKey: queryKeys.academy.lms.allNotes(user?.id ?? ""),
    queryFn: () => fetchAllNotesForUser(user!.id),
    enabled: !!user,
  });

  const bookmarksQuery = useQuery({
    queryKey: queryKeys.academy.lms.allBookmarks(user?.id ?? ""),
    queryFn: () => fetchAllBookmarksForUser(user!.id),
    enabled: !!user,
  });

  const progressQuery = useQuery({
    queryKey: queryKeys.academy.lms.allProgress(user?.id ?? ""),
    queryFn: () => fetchAllProgressForUser(user!.id),
    enabled: !!user,
  });

  return {
    notes: notesQuery.data ?? [],
    bookmarks: bookmarksQuery.data ?? [],
    progress: progressQuery.data ?? [],
    isLoading: notesQuery.isLoading || bookmarksQuery.isLoading || progressQuery.isLoading,
  };
}
