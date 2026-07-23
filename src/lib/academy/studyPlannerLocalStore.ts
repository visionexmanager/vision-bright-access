/**
 * Academy — Study Planner Local Store (Phase 9, temporary)
 * Same localStorage contract as every other *LocalStore.ts file. Goals are
 * user-set targets (real CRUD); progress against them is computed live from
 * the SAME lesson-progress rows lessonLocalStore.ts already tracks — no
 * fabricated activity, and the Study Calendar is a real heatmap of actual
 * completion timestamps, not a mockup.
 */

import type { AcademyStudyGoalRow, AcademyStudyGoalProgress, AcademyStudyDayActivity } from "@/lib/types/academy-planner";
import { searchCoursesAny, getLessonsForCourseAny } from "./instructorLocalStore";
import { getAllProgressForUser } from "./lessonLocalStore";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const GOALS_KEY = "academy:study-goals";

function defaultGoal(userId: string): AcademyStudyGoalRow {
  return { user_id: userId, weekly_lessons_target: 5, daily_minutes_target: 30, updated_at: new Date().toISOString() };
}

export function getStudyGoal(userId: string): AcademyStudyGoalRow {
  const all = readJSON<Record<string, AcademyStudyGoalRow>>(GOALS_KEY, {});
  return all[userId] ?? defaultGoal(userId);
}

export function setStudyGoal(userId: string, weeklyLessonsTarget: number, dailyMinutesTarget: number): AcademyStudyGoalRow {
  const all = readJSON<Record<string, AcademyStudyGoalRow>>(GOALS_KEY, {});
  const next: AcademyStudyGoalRow = {
    user_id: userId,
    weekly_lessons_target: Math.max(1, weeklyLessonsTarget),
    daily_minutes_target: Math.max(5, dailyMinutesTarget),
    updated_at: new Date().toISOString(),
  };
  all[userId] = next;
  writeJSON(GOALS_KEY, all);
  return next;
}

function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay() || 7; // Sunday(0) -> 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One entry per day with at least one completed lesson — real data for the Study Calendar heatmap. */
export function getStudyDayActivity(userId: string): AcademyStudyDayActivity[] {
  const completed = getAllProgressForUser(userId).filter((p) => p.completed);
  const map: Record<string, number> = {};
  for (const p of completed) {
    const date = p.updated_at.slice(0, 10);
    map[date] = (map[date] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([date, lessonsCompleted]) => ({ date, lessonsCompleted }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getStudyGoalProgress(userId: string): AcademyStudyGoalProgress {
  const goal = getStudyGoal(userId);
  const completed = getAllProgressForUser(userId).filter((p) => p.completed);

  const weekStart = startOfWeek();
  const lessonsCompletedThisWeek = completed.filter((p) => new Date(p.updated_at) >= weekStart).length;

  const today = todayKey();
  const todaysLessonIds = new Set(completed.filter((p) => p.updated_at.slice(0, 10) === today).map((p) => p.lesson_id));
  let minutesStudiedToday = 0;
  if (todaysLessonIds.size > 0) {
    for (const course of searchCoursesAny({})) {
      for (const lesson of getLessonsForCourseAny(course.id)) {
        if (todaysLessonIds.has(lesson.id)) minutesStudiedToday += lesson.duration_seconds / 60;
      }
    }
  }

  return { goal, lessonsCompletedThisWeek, minutesStudiedToday: Math.round(minutesStudiedToday) };
}
