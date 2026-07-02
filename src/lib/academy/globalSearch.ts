/**
 * Academy — Global Search (Phase 5, temporary client-side implementation)
 *
 * Cheap, synchronous, in-memory search across every Academy domain. This is
 * the honest today-implementation of services/academy/search.ts's future
 * server-side contract — swap this file's internals for a real full-text
 * search (Postgres tsvector, external index) once data volume needs it; the
 * return shape (GlobalSearchResults) stays identical either way.
 */

import { searchCoursesAny } from "./instructorLocalStore";
import { searchResourcesLocal } from "./libraryLocalStore";
import { searchScholarshipsLocal } from "./scholarshipLocalStore";
import { searchUniversitiesLocal } from "./universityLocalStore";
import { MOCK_INSTRUCTORS } from "./mockCourses";
import type {
  AcademyCourseRow, AcademyInstructorRow, AcademyLibraryResourceRow,
  AcademyScholarshipRow, AcademyUniversityRow,
} from "@/lib/types/academy-modules";

export interface GlobalSearchResults {
  courses: AcademyCourseRow[];
  resources: AcademyLibraryResourceRow[];
  scholarships: AcademyScholarshipRow[];
  universities: AcademyUniversityRow[];
  instructors: AcademyInstructorRow[];
}

export function runGlobalSearch(query: string): GlobalSearchResults {
  const q = query.trim();
  if (!q) {
    return { courses: [], resources: [], scholarships: [], universities: [], instructors: [] };
  }
  const qLower = q.toLowerCase();

  return {
    courses: searchCoursesAny({ query: q }),
    resources: searchResourcesLocal({ query: q }),
    scholarships: searchScholarshipsLocal({ query: q }),
    universities: searchUniversitiesLocal({ query: q }),
    instructors: MOCK_INSTRUCTORS.filter(
      (i) => i.name.toLowerCase().includes(qLower) || (i.headline ?? "").toLowerCase().includes(qLower)
    ),
  };
}

export function getTotalResultCount(results: GlobalSearchResults): number {
  return results.courses.length + results.resources.length + results.scholarships.length + results.universities.length + results.instructors.length;
}
