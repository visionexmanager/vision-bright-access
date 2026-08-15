import type { Subject } from "@/features/visionkids/types/academy.types";

/**
 * Splits the subject catalog by whether a child can actually open anything.
 *
 * A subject row exists as soon as the curriculum plans it, long before its
 * first course is authored. Rendering those the same way produced a wall of
 * tiles reading "0 courses" — a shelf that looks stocked and is not. The
 * pages show `available` and state the number still being prepared instead of
 * pretending each one is a destination.
 */
export function partitionSubjects(subjects: readonly Subject[]) {
  const available = subjects.filter((subject) => subject.course_count > 0);
  return { available, preparingCount: subjects.length - available.length };
}
