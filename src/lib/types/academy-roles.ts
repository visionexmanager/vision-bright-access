/**
 * Academy — Role System (Phase 9, architecture prep only)
 *
 * This models a SCALABLE role/permission shape for future use — it does NOT
 * change how access control actually works today. Real enforcement stays on
 * the existing `user_roles` Supabase table + RLS policies (checked via
 * useAdmin() in src/hooks/useAdmin.ts) for admin, and on
 * academy_instructors/instructor applications (see instructorLocalStore.ts)
 * for instructor status. Nothing here is wired into a gate yet — introducing
 * enforcement against these types would require a real `academy_user_roles`
 * table + RLS, which is future work, not this phase.
 */

export type AcademyRole =
  | "student"
  | "instructor"
  | "moderator"
  | "administrator"
  | "organization_manager"
  | (string & {}); // future custom roles — open string union, not a closed enum

export type AcademyPermission =
  | "academy.courses.view" | "academy.courses.create" | "academy.courses.edit" | "academy.courses.publish" | "academy.courses.delete"
  | "academy.students.view" | "academy.students.manage"
  | "academy.instructors.review" | "academy.instructors.suspend"
  | "academy.assessment.grade" | "academy.assessment.manage"
  | "academy.certificates.issue" | "academy.certificates.revoke"
  | "academy.library.manage" | "academy.scholarships.manage" | "academy.universities.manage"
  | "academy.gamification.configure"
  | "academy.community.moderate"
  | "academy.settings.manage"
  | "academy.analytics.view";

export interface AcademyPermissionGroup {
  role: AcademyRole;
  label: string;
  permissions: AcademyPermission[];
  /** True for the built-in roles above — false for future custom roles an org/admin defines. */
  isSystemRole: boolean;
}

/** Default permission matrix for the built-in roles — a starting point for a future real permissions UI, not an enforced policy. */
export const DEFAULT_ACADEMY_PERMISSION_GROUPS: AcademyPermissionGroup[] = [
  { role: "student", label: "طالب", isSystemRole: true, permissions: ["academy.courses.view"] },
  {
    role: "instructor", label: "مدرّس", isSystemRole: true,
    permissions: [
      "academy.courses.view", "academy.courses.create", "academy.courses.edit", "academy.courses.publish",
      "academy.assessment.grade", "academy.certificates.issue",
    ],
  },
  {
    role: "moderator", label: "مشرف مجتمع", isSystemRole: true,
    permissions: ["academy.courses.view", "academy.students.view", "academy.community.moderate"],
  },
  {
    role: "organization_manager", label: "مدير مؤسسة", isSystemRole: true,
    permissions: ["academy.courses.view", "academy.students.view", "academy.instructors.review", "academy.analytics.view"],
  },
  {
    role: "administrator", label: "مدير النظام", isSystemRole: true,
    permissions: [
      "academy.courses.view", "academy.courses.create", "academy.courses.edit", "academy.courses.publish", "academy.courses.delete",
      "academy.students.view", "academy.students.manage",
      "academy.instructors.review", "academy.instructors.suspend",
      "academy.assessment.grade", "academy.assessment.manage",
      "academy.certificates.issue", "academy.certificates.revoke",
      "academy.library.manage", "academy.scholarships.manage", "academy.universities.manage",
      "academy.gamification.configure", "academy.community.moderate",
      "academy.settings.manage", "academy.analytics.view",
    ],
  },
];
