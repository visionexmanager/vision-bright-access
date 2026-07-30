import type { ComponentType } from "react";
import {
  ClockWidget, WeatherWidget, TodaysChallengeWidget, ContinueReadingWidget,
  ProgressWidget, AchievementsWidget, DailyGoalWidget, CalendarWidget,
  BookmarksWidget, AISuggestionsWidget,
} from "@/features/visionkids/components/platform/widgets";

/**
 * Widget registry — resolves a widget's catalog `slug` to a built-in React
 * component. This is the Widget System's extension point: a new widget is a
 * `kids_widgets` row + one entry here. The dashboard renders whatever a child
 * has selected, in order, purely from data.
 */
export const WIDGET_REGISTRY: Record<string, ComponentType> = {
  clock: ClockWidget,
  weather: WeatherWidget,
  "todays-challenge": TodaysChallengeWidget,
  "continue-reading": ContinueReadingWidget,
  progress: ProgressWidget,
  achievements: AchievementsWidget,
  "daily-goal": DailyGoalWidget,
  calendar: CalendarWidget,
  bookmarks: BookmarksWidget,
  "ai-suggestions": AISuggestionsWidget,
};

export function getWidgetComponent(slug: string): ComponentType | null {
  return WIDGET_REGISTRY[slug] ?? null;
}
