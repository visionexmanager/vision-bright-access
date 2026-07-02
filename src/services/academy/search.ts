// ─── Academy — Global Search Service Stub (Phase 5 architecture prep) ────────
// The real implementation the UI runs against today lives in
// src/lib/academy/globalSearch.ts, which queries the existing Phase 3 course
// catalog (mockCourses.ts) plus the Phase 5 local stores directly — cheap and
// synchronous since everything is client-side. This stub models the future
// server-side full-text-search contract (e.g. Postgres tsvector or an
// external search index) once real data volume needs it.

import type { AcademyCourseRow, AcademyInstructorRow, AcademyUniversityRow } from "@/lib/types/academy-modules";
import type { AcademyLibraryResourceRow, AcademyScholarshipRow } from "@/lib/types/academy-modules";
import type { AcademyStudentServiceRequestRow } from "@/lib/types/academy-modules";

export interface GlobalSearchResults {
  courses: AcademyCourseRow[];
  resources: AcademyLibraryResourceRow[];
  scholarships: AcademyScholarshipRow[];
  universities: AcademyUniversityRow[];
  instructors: AcademyInstructorRow[];
  studentServices: AcademyStudentServiceRequestRow[];
}

export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  void query;
  return {
    courses: [], resources: [], scholarships: [], universities: [], instructors: [], studentServices: [],
  };
}
