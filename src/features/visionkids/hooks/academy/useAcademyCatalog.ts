import { useQuery } from "@tanstack/react-query";
import * as catalog from "@/features/visionkids/services/academy/catalog";
import type { AcademyAgeRange } from "@/features/visionkids/types/academy.types";

export function useSubjects() {
  return useQuery({ queryKey: ["kids-academy", "subjects"], queryFn: catalog.fetchSubjects, staleTime: 10 * 60 * 1000 });
}

export function useSubjectBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "subject", slug], queryFn: () => catalog.fetchSubjectBySlug(slug!), enabled: !!slug });
}

export function useCoursesBySubject(subjectSlug: string | undefined, ageRange?: AcademyAgeRange) {
  return useQuery({
    queryKey: ["kids-academy", "courses-by-subject", subjectSlug, ageRange],
    queryFn: () => catalog.fetchCoursesBySubject(subjectSlug!, ageRange),
    enabled: !!subjectSlug,
  });
}

export function useCourseBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "course", slug], queryFn: () => catalog.fetchCourseBySlug(slug!), enabled: !!slug });
}

export function useFeaturedCourses(limit = 12) {
  return useQuery({ queryKey: ["kids-academy", "featured-courses", limit], queryFn: () => catalog.fetchFeaturedCourses(limit) });
}

export function useCourseUnits(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "units", courseId], queryFn: () => catalog.fetchCourseUnits(courseId!), enabled: !!courseId });
}

export function useCourseLessons(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "lessons", courseId], queryFn: () => catalog.fetchCourseLessons(courseId!), enabled: !!courseId });
}

export function useLessonBySlug(courseId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: ["kids-academy", "lesson", courseId, slug],
    queryFn: () => catalog.fetchLessonBySlug(courseId!, slug!),
    enabled: !!courseId && !!slug,
  });
}

export function useLessonActivities(lessonId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "activities", lessonId], queryFn: () => catalog.fetchLessonActivities(lessonId!), enabled: !!lessonId });
}

export function useCourseWorksheets(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "worksheets", courseId], queryFn: () => catalog.fetchCourseWorksheets(courseId!), enabled: !!courseId });
}

export function useCourseProjects(courseId: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "projects", courseId], queryFn: () => catalog.fetchCourseProjects(courseId!), enabled: !!courseId });
}

export function useProjectById(id: string | undefined) {
  return useQuery({ queryKey: ["kids-academy", "project", id], queryFn: () => catalog.fetchProjectById(id!), enabled: !!id });
}

export function useDownloadableLessons() {
  return useQuery({ queryKey: ["kids-academy", "downloadable-lessons"], queryFn: () => catalog.fetchDownloadableLessons() });
}

export function useAllWorksheets() {
  return useQuery({ queryKey: ["kids-academy", "all-worksheets"], queryFn: () => catalog.fetchAllWorksheets() });
}

export function useSearchCourses(query: string, ageRange?: AcademyAgeRange) {
  return useQuery({ queryKey: ["kids-academy", "search", query, ageRange], queryFn: () => catalog.searchCourses(query, ageRange) });
}
