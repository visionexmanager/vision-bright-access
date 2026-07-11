/**
 * useCourseDetail — a single course with its modules, lessons, reviews, and
 * similar-courses, plus reading/submitting a review (Phase 1 backend).
 */

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchCourseById,
  fetchCourseModules,
  fetchCourseLessons,
  fetchSimilarCourses,
  fetchCourseReviews,
  submitCourseReview,
  fetchInstructorById,
} from "@/services/academy/lms";
import type { AcademyCourseReviewRow } from "@/lib/types/academy-lms";

export function useCourseDetail(courseId: string | undefined) {
  const enabled = !!courseId;

  const courseQuery = useQuery({
    queryKey: queryKeys.academy.lms.course(courseId ?? ""),
    queryFn: () => fetchCourseById(courseId!),
    enabled,
  });

  const modulesQuery = useQuery({
    queryKey: queryKeys.academy.lms.modules(courseId ?? ""),
    queryFn: () => fetchCourseModules(courseId!),
    enabled,
  });

  const lessonsQuery = useQuery({
    queryKey: queryKeys.academy.lms.lessons(courseId ?? ""),
    queryFn: () => fetchCourseLessons(courseId!),
    enabled,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.academy.lms.reviews(courseId ?? ""),
    queryFn: () => fetchCourseReviews(courseId!),
    enabled,
  });

  const similarQuery = useQuery({
    queryKey: queryKeys.academy.lms.similar(courseId ?? ""),
    queryFn: () => fetchSimilarCourses(courseId!),
    enabled,
  });

  const instructorId = courseQuery.data?.instructor_id;
  const instructorQuery = useQuery({
    queryKey: queryKeys.academy.instructor.profile(instructorId ?? ""),
    queryFn: () => fetchInstructorById(instructorId!),
    enabled: !!instructorId,
  });

  const modulesWithLessons = useMemo(() => {
    const modules = modulesQuery.data ?? [];
    const lessons = lessonsQuery.data ?? [];
    return modules.map((m) => ({ module: m, lessons: lessons.filter((l) => l.module_id === m.id) }));
  }, [modulesQuery.data, lessonsQuery.data]);

  const isLoading = courseQuery.isLoading || modulesQuery.isLoading || lessonsQuery.isLoading;

  return {
    course: courseQuery.data ?? null,
    instructor: instructorQuery.data ?? null,
    modules: modulesQuery.data ?? [],
    lessons: lessonsQuery.data ?? [],
    modulesWithLessons,
    reviews: reviewsQuery.data ?? [],
    similarCourses: similarQuery.data ?? [],
    isLoading,
    error: courseQuery.error ? (courseQuery.error as Error).message : null,
  };
}

export function useSubmitCourseReview(courseId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (input: { rating: AcademyCourseReviewRow["rating"]; comment: string | null }) =>
      submitCourseReview({ user_id: user!.id, course_id: courseId!, rating: input.rating, comment: input.comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.reviews(courseId ?? "") });
    },
  });

  return { submitReview: mutateAsync, isSubmitting: isPending };
}
