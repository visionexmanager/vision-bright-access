/**
 * useInstructorCourses — the instructor dashboard's course list + CRUD, and
 * the instructor's own profile (created lazily once their application is
 * approved). Phase 1 backend, replaces the course-management parts of
 * instructorLocalStore.ts.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  getOrCreateMyInstructorProfile,
  fetchInstructorCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  duplicateCourse,
  setCourseStatus,
  saveCourseModules,
  saveCourseLessons,
} from "@/services/academy/instructor";
import type { AcademyCourseRow, AcademyCourseModuleRow } from "@/lib/types/academy-modules";
import type { AcademyLessonRow } from "@/lib/types/academy-lms";

/** Fetches (and lazily creates, if the application was approved) the caller's own instructor profile. */
export function useMyInstructorProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.academy.instructor.myProfile(user?.id ?? ""),
    queryFn: () => getOrCreateMyInstructorProfile(user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (query.data) {
      queryClient.setQueryData(queryKeys.academy.instructor.profile(query.data.id), query.data);
    }
  }, [query.data, queryClient]);

  return { profile: query.data ?? null, isLoading: query.isLoading };
}

export function useInstructorCourses() {
  const { profile } = useMyInstructorProfile();
  const instructorId = profile?.id;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.academy.instructor.myCourses(instructorId ?? ""),
    queryFn: () => fetchInstructorCourses(instructorId!),
    enabled: !!instructorId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.instructor.myCourses(instructorId ?? "") });

  const create = useMutation({
    mutationFn: (course: Partial<AcademyCourseRow>) => createCourse({ ...course, instructor_id: instructorId! }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (params: { courseId: string; updates: Partial<AcademyCourseRow> }) => updateCourse(params.courseId, params.updates),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (courseId: string) => deleteCourse(courseId),
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: (courseId: string) => duplicateCourse(courseId),
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: (params: { courseId: string; status: AcademyCourseRow["status"] }) => setCourseStatus(params.courseId, params.status),
    onSuccess: invalidate,
  });

  return {
    instructorId,
    courses: data ?? [],
    isLoading,
    createCourse: create.mutateAsync,
    isCreating: create.isPending,
    updateCourse: update.mutateAsync,
    deleteCourse: remove.mutateAsync,
    duplicateCourse: duplicate.mutateAsync,
    setCourseStatus: setStatus.mutateAsync,
  };
}

/** Bulk-saves the module/lesson structure from the course builder UI. */
export function useSaveCourseStructure(courseId: string | undefined) {
  const queryClient = useQueryClient();

  const saveModules = useMutation({
    mutationFn: (modules: AcademyCourseModuleRow[]) => saveCourseModules(courseId!, modules),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.modules(courseId ?? "") }),
  });

  const saveLessons = useMutation({
    mutationFn: (lessons: AcademyLessonRow[]) => saveCourseLessons(courseId!, lessons),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.academy.lms.lessons(courseId ?? "") }),
  });

  return {
    saveModules: saveModules.mutateAsync,
    saveLessons: saveLessons.mutateAsync,
    isSaving: saveModules.isPending || saveLessons.isPending,
  };
}
