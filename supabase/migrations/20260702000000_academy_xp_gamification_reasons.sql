-- ============================================================
-- Migration: academy_xp_events — Phase 7 (Gamification) reasons
-- Purpose:   Documentation-only update. academy_xp_events.reason is a plain
--            TEXT column with no CHECK constraint or enum (see
--            20260609100002_academy_xp_events.sql), so the new reason
--            strings introduced by Academy Gamification work with zero
--            schema change — this migration only refreshes the column
--            comment so the valid-reasons list stays accurate for anyone
--            reading the schema. No new VX wallet, table, or RPC is
--            introduced — Phase 7 exclusively reuses award_academy_xp(),
--            which already mirrors into the existing public.user_points
--            (global VX) balance.
-- ============================================================

COMMENT ON COLUMN public.academy_xp_events.reason IS
  'Valid reasons — award_academy_xp() accepts any of these (plain TEXT, no DB constraint):
   academy_message_sent            — user sent a chat message to Munir
   academy_aptitude_completed      — completed the career aptitude test
   academy_streak                  — daily login streak in Academy
   academy_scan_used               — used the OCR scanner in Academy
   academy_study_room              — opened a study room session
   academy_daily_login             — first Academy visit of the day
   academy_lesson_completed        — marked a lesson as complete
   academy_module_completed        — completed every lesson in a module
   academy_course_completed        — completed every lesson in a course
   academy_quiz_passed             — passed a quiz attempt
   academy_perfect_quiz            — scored 100% on a quiz attempt
   academy_final_exam_passed       — passed a quiz with scope = final_exam
   academy_certificate_earned      — a course certificate was issued
   academy_project_completed       — submitted a project for review
   academy_weekly_goal             — completed the weekly learning mission
   academy_monthly_goal            — completed the monthly learning mission
   academy_streak_milestone        — reached a streak milestone (3/7/15/30/100/365 days)
   academy_community_contribution  — recognized community contribution (prepared, not yet auto-triggered)
   academy_instructor_recognition  — instructor-granted recognition (prepared, not yet auto-triggered)';
