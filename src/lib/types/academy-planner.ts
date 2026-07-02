/**
 * Academy — Study Planner Types (Phase 9, Control Center)
 * Planned table: academy_study_goals (one row per user). Local-store only for
 * now, same temporary contract as every other *LocalStore.ts file.
 */

export interface AcademyStudyGoalRow {
  user_id: string;
  weekly_lessons_target: number;
  daily_minutes_target: number;
  updated_at: string;
}

export interface AcademyStudyGoalProgress {
  goal: AcademyStudyGoalRow;
  lessonsCompletedThisWeek: number;
  minutesStudiedToday: number;
}

/** One entry per active day — powers the Study Calendar heatmap. Derived live from real lesson-progress timestamps, never fabricated. */
export interface AcademyStudyDayActivity {
  date: string; // YYYY-MM-DD
  lessonsCompleted: number;
}
