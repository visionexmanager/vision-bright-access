/**
 * Academy — Global Search (Phase 5, temporary client-side implementation)
 *
 * Cheap, synchronous, in-memory search across every Academy domain. This is
 * the honest today-implementation of services/academy/search.ts's future
 * server-side contract — swap this file's internals for a real full-text
 * search (Postgres tsvector, external index) once data volume needs it; the
 * return shape (GlobalSearchResults) stays identical either way.
 */

import { searchResourcesLocal } from "./libraryLocalStore";
import { searchScholarshipsLocal } from "./scholarshipLocalStore";
import { searchUniversitiesLocal } from "./universityLocalStore";
import { fetchCourseCatalog } from "@/services/academy/lms";
import { supabase } from "@/integrations/supabase/client";
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

export async function runGlobalSearch(query: string): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (!q) {
    return { courses: [], resources: [], scholarships: [], universities: [], instructors: [] };
  }
  const term = q.replace(/[%,]/g, "");

  const [courses, instructorsResult] = await Promise.all([
    fetchCourseCatalog({ query: q }),
    (supabase.from("academy_instructors") as any)
      .select("*")
      .or(`name.ilike.%${term}%,headline.ilike.%${term}%`)
      .limit(12),
  ]);

  return {
    courses,
    resources: searchResourcesLocal({ query: q }),
    scholarships: searchScholarshipsLocal({ query: q }),
    universities: searchUniversitiesLocal({ query: q }),
    instructors: (instructorsResult.data ?? []) as AcademyInstructorRow[],
  };
}

export function getTotalResultCount(results: GlobalSearchResults): number {
  return results.courses.length + results.resources.length + results.scholarships.length + results.universities.length + results.instructors.length;
}
