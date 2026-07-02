# VisionEx Academy — Developer Documentation

Internal architecture reference for the Academy module inside the VisionEx platform. This document
covers what exists today, how it's organized, and what a future contributor needs to know before
extending it. It reflects the state after the "Control Center" phase (student/instructor/admin
dashboards) and the subsequent production-readiness pass.

## 1. Architecture Summary

The Academy is a feature module inside the main VisionEx React app — **not** a separate app, package,
or deployment. It shares the platform's routing (`react-router-dom`), auth (`AuthContext`), theming
(`ThemeContext`), i18n (`LanguageContext`), and data layer (Supabase client + TanStack Query) with
every other VisionEx feature (Marketplace, Games, Finance, TV/Radio, etc.).

Two data-persistence tiers coexist by design:

1. **Real Supabase tables** — `academy_profiles`, `academy_xp_events`, `notifications`, `user_points`,
   `user_roles`. These sync across devices, are protected by Row Level Security, and are the only
   sources an admin can query cross-user.
2. **Client-only localStorage "local stores"** — courses, modules, lessons, instructor profiles,
   quizzes/assignments/projects, certificates, library resources, scholarships, universities,
   achievements, missions, streaks, notes, bookmarks, study goals. Each lives in one
   `src/lib/academy/*LocalStore.ts` file, is namespaced under an `academy:*` localStorage key, and is
   explicitly documented in its own file header as **temporary and per-browser** — it does not sync
   across devices and is lost if the user clears site data.

This split is intentional and was made explicit at every phase: build the full UI and business logic
against the *shape* of the future real tables (see `src/lib/types/academy-*.ts`), so migrating a given
local store to real Supabase persistence later is a drop-in swap of the read/write functions inside
that one file — no caller anywhere else needs to change.

**This is the single most important thing for a new contributor to understand**: most of what looks
like a full LMS backend (courses, grading, certificates, instructor rosters) is real, working logic,
but the storage underneath the bulk of it is per-browser, not centralized. See §9 "Known Limitations."

## 2. Folder Structure

```
src/
  pages/academy/            One file per route (AcademyCourseDetail.tsx, AcademyLearningPlayer.tsx, ...)
  pages/admin/               Admin*.tsx — one per /admin/* route, including AdminAcademy*.tsx
  components/academy/
    ui/                      Shared primitives (AcademySectionHeader, AcademyPlaceholderSection, ...)
    sections/                Student dashboard sections (PersonalProgressSection, AchievementsSection, ...)
    lms/                     Course/lesson UI (CourseCard, LearningPlayerSidebar, ...)
    instructor/               Instructor Dashboard tab components (InstructorCoursesSection, ...)
    assessment/               Quiz/Assignment/Project player + builder components
    gamification/             XP/level/achievement/badge/mission/leaderboard UI
    notifications/             Shared notification history list (student page + instructor tab)
    library/, ...              Domain-specific presentational components
  hooks/academy/               useAcademyProfile, useAcademyChat, useGamificationTick
  lib/academy/
    *LocalStore.ts             One per domain — see §4
    localStorageUtils.ts        Shared readJSON/writeJSON (all local stores import from here)
    mockCourses.ts, mockAssessments.ts   Static bundled sample content (shared across all users, not "fake data")
    leveling.ts, xp.ts          Level/rank math (leveling.ts) and legacy 5-tier XP labels (xp.ts)
    accessibilityPrefs.ts       Text-scale / manual reduce-motion (applies on app load)
    notify.ts                   notify_self() wrapper
  lib/types/
    academy.ts                  Core profile + XP reason types (Phase 1)
    academy-modules.ts           Course/lesson/certificate/scholarship/university row shapes
    academy-lms.ts, academy-instructor.ts, academy-library.ts, academy-scholarship.ts,
    academy-university.ts, academy-certificate.ts, academy-gamification.ts,
    academy-planner.ts, academy-roles.ts   One file per phase's additions
  services/academy/
    academyService.ts            Real Supabase calls: profile CRUD, awardAcademyXP(), XP rates
    lms.ts, instructor.ts, assessment.ts, certificates.ts, library.ts, scholarships.ts,
    universities.ts, search.ts, modules.ts, gamification.ts   Future-Supabase-shaped service stubs
supabase/migrations/            One file per schema change — see §5
```

## 3. Module Map (by phase)

| Phase | What it added |
|---|---|
| 1 | Architecture scaffolding, XP utility, module registry |
| 2 | Smart dashboard (20 sections) |
| 3 | Full LMS: courses → modules → lessons → learning player, learning paths |
| 4 | Instructor Platform: application flow, dashboard, course/lesson editor, admin approval |
| 5 | Digital Library, Scholarships Center, Universities Directory, Global Search |
| 6 | Assessment & Certification: quizzes, assignments, projects, certificates |
| 7 | Gamification: numbered levels/ranks, achievements, badges, streaks, missions, leaderboard (honest single-user), learning cards, celebrations — all routed through the **existing** VX economy, no new wallet |
| 9 | Control Center: Student/Instructor/Admin dashboards completed — Notification Center (reuses the site-wide `notifications` table), Study Planner/Goals/Calendar, My Courses/My Work/Saved/Settings pages, Instructor Content/Media Management + course status filters + per-course performance, Admin Academy hub (real cross-user Students + Analytics, read-only Gamification config), Role System types (prep) |
| 10 | Production-readiness pass: security review, duplicate-code extraction (`localStorageUtils.ts`), CSV-injection hardening, this document |

## 4. Local Store Reference

Every `src/lib/academy/*LocalStore.ts` file follows the same contract: a private
`Record<key, Row>` or `Row[]` behind a fixed `localStorage` key, read/written via the shared
`readJSON`/`writeJSON` from `localStorageUtils.ts`, exposing typed CRUD functions. Several expose an
**"Any" merged lookup** (`getCourseByIdAny`, `getLessonsForCourseAny`, `searchCoursesAny`, ...) that
transparently combines the static bundled sample catalog (`mockCourses.ts`) with locally-authored
content, so instructor-created courses appear in the real catalog/player end-to-end, not just inside
the instructor dashboard.

| Store | Key prefix | Notes |
|---|---|---|
| `lessonLocalStore.ts` | `academy:lesson-*` | Progress, notes, bookmarks — has `getAllNotesForUser`/`getAllBookmarksForUser`/`getAllProgressForUser` aggregators (Phase 9) |
| `instructorLocalStore.ts` | `academy:instructor-*` | Applications, profile, courses, modules, lessons, announcements — "single application per browser" (documented demo-scope) |
| `assessmentLocalStore.ts` | `academy:quiz*` / `academy:assignment*` / `academy:project*` | Grading logic, reverse lookups (`getQuizByIdAny` etc., added Phase 9) |
| `certificateLocalStore.ts` | `academy:certificate*` | Eligibility computed live from the above, never faked |
| `libraryLocalStore.ts`, `scholarshipLocalStore.ts`, `universityLocalStore.ts` | `academy:library-*` / `academy:scholarships` / `academy:universities` | No pre-seeded catalog content — starts empty, populated via `Admin*.tsx` forms only |
| `gamificationLocalStore.ts` | `academy:user-achievements` etc. | Fixed catalogs (achievements/missions/learning cards) are bundled game-design content, same precedent as `xp.ts` — unlock *state* is real, computed from the stores above |
| `studyPlannerLocalStore.ts` | `academy:study-goals` | Goals are real CRUD; calendar heatmap derived from real `lesson-progress` timestamps |

## 5. Database Schema (real tables only)

Local-store data has no schema (see §4). The tables that genuinely exist in Supabase:

- **`academy_profiles`** (`user_id` PK) — name, gender, country, level, `xp_total`, `streak_days`,
  `last_active`. RLS: owner full access; `academy_profiles: admins read all` policy lets admins SELECT
  every row (powers `/admin/academy/students`).
- **`academy_xp_events`** (`id`, `user_id`, `amount`, `reason`, `created_at`) — append-only ledger,
  written exclusively through `award_academy_xp()`. RLS: owner read; `academy_xp_events: admins read
  all` (added Phase 10) lets admins aggregate real cross-user XP trends (powers
  `/admin/academy/analytics`).
- **`notifications`** (`id`, `user_id`, `title`, `body`, `type` ∈ `info|warning|success|error`,
  `is_read`, `sent_by`, `created_at`) — **not Academy-specific**, shared with the rest of VisionEx
  (`NotificationBell.tsx` in the Navbar). RLS: admins full access (broadcast), users read/update own row.
- **`user_points`** — the platform-wide VX ledger. Academy never writes here directly; `award_academy_xp()`
  does, in the same transaction as the XP event.
- **`user_roles`** — `role = 'admin'` checked by `useAdmin()` and by the two admin-read RLS policies
  above. This is the *only* real role-enforcement mechanism today (see §7).

### RPCs

- **`award_academy_xp(_user_id, _amount, _reason)`** (Phase 1) — `SECURITY DEFINER`. Inserts into
  `academy_xp_events` + `user_points`, updates `academy_profiles.xp_total`. Trusts the caller-supplied
  `_user_id` (existing precedent, unchanged).
- **`notify_self(_title, _body, _type)`** (Phase 9) — `SECURITY DEFINER`, `SET search_path = public`.
  Always targets `auth.uid()` internally (never a parameter) — a user can only ever notify themselves.
  Used for certificate-earned and achievement-unlocked notifications, both self-triggered client events.

### Migrations touching Academy

All under `supabase/migrations/`, chronological: `20260609100000_academy_profiles.sql`,
`20260609100002_academy_xp_events.sql`, `20260422000000_admin_panel_expansion.sql` (adds the shared
`notifications` table), `20260702000000_academy_xp_gamification_reasons.sql` (doc-only comment, no
schema change), `20260703000000_academy_notify_self.sql`, `20260704000000_academy_xp_events_admin_read.sql`.

**Rollback**: every migration here is additive (`CREATE TABLE IF NOT EXISTS`, `CREATE POLICY`,
`CREATE OR REPLACE FUNCTION`) — none drops or alters existing columns destructively, so rollback is
simply `DROP POLICY` / `DROP FUNCTION` / `DROP TABLE` for the specific object added, with no data-loss
risk to earlier migrations.

## 6. Service Layer / "API" Structure

There is no custom REST/GraphQL API — the Academy talks to Supabase directly via the generated client
(`@/integrations/supabase/client`) from `src/services/academy/academyService.ts` (the only service file
with real implementations) plus RPC calls. The other `src/services/academy/*.ts` files
(`lms.ts`, `instructor.ts`, `assessment.ts`, `certificates.ts`, `library.ts`, `scholarships.ts`,
`universities.ts`, `search.ts`, `modules.ts`, `gamification.ts`) are typed **stubs** matching the future
real-table contract — they exist so a future migration to real persistence changes only what's inside
these files, not any calling component.

"Pagination/filtering/sorting" today means: client-side array `.filter()`/`.sort()`/`.slice()` over
localStorage data, or `.range()`/`.order()` on a genuinely small Supabase result set (student list capped
at 2000 rows with client-side pagination in `AdminAcademyStudents.tsx`). This does not scale to millions
of rows — see §9.

## 7. Permissions / Role System

**Real enforcement today**: `useAdmin()` (`src/hooks/useAdmin.ts`) queries `user_roles` for
`role = 'admin'`; `<AdminRoute>` gates every `/admin/*` route on it; the two `admins read all` RLS
policies (§5) are the actual database-level enforcement. Instructor status is tracked per-browser in
`academy_instructors` (local store) — there is no real instructor role in `user_roles`.

**Prepared, not enforced**: `src/lib/types/academy-roles.ts` (Phase 9) models a `AcademyRole` union
(student/instructor/moderator/administrator/organization_manager/custom) and a default
`AcademyPermissionGroup[]` permission matrix. Nothing reads these types yet — they're a starting shape
for a future real `academy_user_roles` table + permission-gated UI, explicitly not wired to avoid
faking enforcement that doesn't exist.

## 8. Extension Points (for future work)

- **Live Classes / Virtual Classrooms / Video Conferencing**: `AcademyLessonRow.kind` already has a
  `"live_session"` variant with `live_session_scheduled_at` — UI shows it as "preparation only, no real
  streaming." A real implementation plugs into that field plus a new video-conferencing service.
- **Peer-to-Peer Learning / Group Projects**: `AcademyProjectRow` currently models solo submissions;
  extending `AcademyProjectSubmissionRow` with a `group_id` and a new `academy_project_groups` table is
  the natural extension point.
- **Organization Accounts / University Partnerships / Enterprise Learning**: `AcademyRole` already
  reserves `organization_manager`; no `organizations` table exists yet — see the Admin Academy hub's
  honest "Organizations: not built" note.
- **SCORM / LTI**: `AcademyLessonRow.kind` would need a new `"scorm_package"` / `"lti_launch"` variant;
  nothing today assumes lesson content is always first-party.
- **Additional AI Providers**: the AI Learning Center (`AILearningCenterSection.tsx`) already goes
  through `useAcademyChat()` → an edge function, not a hardcoded provider call in the component — the
  provider lives server-side and is swappable without touching this component.
- **Native Mobile / Desktop**: the whole Academy is web-only React; nothing here blocks a future
  React Native/Electron shell other than the localStorage dependency (§9) — a mobile app in particular
  would need every local store migrated to real Supabase persistence first, since `window.localStorage`
  isn't shared between a web session and a native app.
- **Marketplace Expansion**: certificates/achievements already model `AcademyCelebrationRow`
  (share/react) — a "sell a course" flow would extend `AcademyCourseRow` with pricing fields, currently
  absent by design (Instructor Dashboard's Revenue/Payouts tabs are explicitly UI-only placeholders).

## 9. Known Limitations (read before promising a feature works)

1. **Most Academy data is per-browser, not per-account.** Courses an instructor authors, quiz/assignment/
   project submissions, certificates, library/scholarship/university catalogs, notes, and bookmarks all
   live in `localStorage`. They do not sync across devices and are lost on cache-clear. Only
   `academy_profiles`, `academy_xp_events`, `notifications`, `user_points`, and `user_roles` are real.
2. **Instructor "Student Progress" and "Course Performance" are honestly scoped to this-browser-only
   data** (explicitly labeled in the UI) — a true cross-student view needs the local stores above
   migrated to real tables first. This was deliberately *not* faked with plausible-looking numbers.
3. **Leaderboards show only the current user's own entry** — same root cause; documented as such in
   `gamificationLocalStore.ts` and the Leaderboard page copy.
4. **No real video/file hosting.** `video_url`/`file_url` fields expect a URL the instructor pastes in;
   there is no upload pipeline. `InstructorMediaSection.tsx` is honest about this.
5. **No AI grading pipeline.** Essay/code quiz answers and all assignment/project submissions require a
   human instructor to grade.
6. **Revenue/Payouts are UI-only placeholders** — no payment processing exists.
7. **Community-contribution and instructor-recognition XP reasons are typed and rated but never
   auto-triggered** — no event source exists yet to hang them on.
8. **This sandbox has no Node/npm available**, so every phase's "testing" has been manual code review
   (import/export tracing, icon-existence checks, git-scope diffing) rather than `tsc`/`vitest`/`eslint`/
   a real browser. Before shipping, run the real toolchain locally.

## 10. Coding Conventions

- Arabic-first hardcoded UI text throughout Academy (not routed through `t()`), matching the established
  convention — the one exception is the shared `AdminDashboard.tsx` `ADMIN_CARDS` grid, which genuinely
  requires `t()` lookups since it's shared with the rest of the admin panel.
- `aria-labelledby` on every `<section>`, `aria-hidden="true"` on decorative icons, `sr-only` labels on
  icon-only controls, `focus-visible:ring-2 focus-visible:ring-primary` on interactive elements.
- New icons: named imports only (`import { Icon } from "lucide-react"`), never `import * as Icons` —
  see `achievementIcons.ts` for the explicit-map pattern used where a dynamic icon lookup is needed.
- New local-store functions: import `readJSON`/`writeJSON` from `localStorageUtils.ts`, never redefine
  them locally.
- When adding a new XP-earning event: add the reason to `AcademyXPReason` (`lib/types/academy.ts`) and
  a rate to `ACADEMY_XP_RATES` (`services/academy/academyService.ts`), then call the existing
  `awardAcademyXP()` — never write to `user_points` or `academy_profiles.xp_total` directly.
- When a client event should notify the current user: call `notifyAcademySelf()` (`lib/academy/notify.ts`)
  — never insert into `notifications` directly from client code (RLS blocks non-admin direct inserts by
  design).

## 11. Maintenance Guide

- **Migrating a local store to real persistence**: pick one `*LocalStore.ts` file, design the real table
  + RLS mirroring its shape, then swap only that file's function bodies to Supabase calls — every caller
  elsewhere is unaffected because they only ever import the function signatures, not the storage
  mechanism.
- **Adding a new admin management page**: follow `AdminAcademyStudents.tsx`'s pattern (search + filter +
  sort + client pagination + CSV export with `csvCell()` escaping) rather than inventing a new table
  pattern.
- **Adding a new gamification achievement/mission**: append to `ACHIEVEMENT_CATALOG` /
  `MISSION_CATALOG` in `gamificationLocalStore.ts` — these are fixed game-design content, not
  admin-editable data (documented precedent, same as `XP_LEVELS`).
- **Before any release**: run `npm run build` and `npm run lint` locally (unavailable in this sandbox),
  smoke-test the golden path for each of Student/Instructor/Admin dashboards, and re-read §9 to confirm
  no claim being made to stakeholders assumes cross-device data that doesn't actually sync.
