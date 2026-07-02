/**
 * Academy — Sample Organization Data (Phase 4, temporary)
 * Same status as mockCourses.ts: not backed by Supabase, exists so the
 * instructor profile page can render an organization affiliation.
 */

import type { AcademyOrganizationRow } from "@/lib/types/academy-instructor";

export const MOCK_ORGANIZATIONS: AcademyOrganizationRow[] = [
  {
    id: "org-visionex",
    name: "أكاديمية Visionex",
    type: "company",
    logo_url: null,
    website_url: "https://visionex.app",
    description: "الفريق الرسمي المسؤول عن إنتاج محتوى Visionex الأصلي.",
    owner_user_id: "system",
    instructor_ids: ["instructor-visionex-team"],
    verified: true,
    created_at: new Date().toISOString(),
  },
];

export function getOrganizationById(id: string): AcademyOrganizationRow | null {
  return MOCK_ORGANIZATIONS.find((o) => o.id === id) ?? null;
}
