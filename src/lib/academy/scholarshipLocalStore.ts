/**
 * Academy — Scholarships Center Local Store (Phase 5, temporary)
 * Same contract as libraryLocalStore.ts: no pre-seeded scholarship data,
 * catalog starts empty and is populated via AdminScholarships.tsx.
 */

import type { AcademyScholarshipRow, AcademyScholarshipCategory, AcademyScholarshipFundingLevel } from "@/lib/types/academy-modules";
import type { AcademyScholarshipReminderRow } from "@/lib/types/academy-scholarship";
import { readJSON, writeJSON } from "../storage/localStorageUtils";

const SCHOLARSHIPS_KEY = "academy:scholarships";
const SAVED_KEY = "academy:saved-scholarships";
const VIEWS_KEY = "academy:scholarship-views";
const REMINDERS_KEY = "academy:scholarship-reminders";

// ── Scholarships (admin-authored catalog) ─────────────────────────────────────

export function getAllScholarshipsLocal(): AcademyScholarshipRow[] {
  return Object.values(readJSON<Record<string, AcademyScholarshipRow>>(SCHOLARSHIPS_KEY, {}));
}

export function getScholarshipByIdLocal(id: string): AcademyScholarshipRow | null {
  return readJSON<Record<string, AcademyScholarshipRow>>(SCHOLARSHIPS_KEY, {})[id] ?? null;
}

export function createScholarshipLocal(data: Partial<AcademyScholarshipRow>): AcademyScholarshipRow {
  const all = readJSON<Record<string, AcademyScholarshipRow>>(SCHOLARSHIPS_KEY, {});
  const id = `local-scholarship-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const scholarship: AcademyScholarshipRow = {
    id,
    title: data.title ?? "منحة بدون عنوان",
    provider: data.provider ?? "",
    country: data.country ?? "",
    amount: data.amount ?? null,
    deadline: data.deadline ?? null,
    url: data.url ?? null,
    category: (data.category ?? "government") as AcademyScholarshipCategory,
    university: data.university ?? null,
    degree: data.degree ?? null,
    funding_level: (data.funding_level ?? "partial") as AcademyScholarshipFundingLevel,
    eligibility: data.eligibility ?? [],
    required_documents: data.required_documents ?? [],
    application_process: data.application_process ?? null,
    website_url: data.website_url ?? data.url ?? null,
    contact_email: data.contact_email ?? null,
    status: data.status ?? "open",
    language: data.language ?? "العربية",
    study_fields: data.study_fields ?? [],
    created_at: now,
    updated_at: now,
  };
  all[id] = scholarship;
  writeJSON(SCHOLARSHIPS_KEY, all);
  return scholarship;
}

export function updateScholarshipLocal(id: string, updates: Partial<AcademyScholarshipRow>): AcademyScholarshipRow | null {
  const all = readJSON<Record<string, AcademyScholarshipRow>>(SCHOLARSHIPS_KEY, {});
  const existing = all[id];
  if (!existing) return null;
  const next = { ...existing, ...updates, updated_at: new Date().toISOString() };
  all[id] = next;
  writeJSON(SCHOLARSHIPS_KEY, all);
  return next;
}

export function deleteScholarshipLocal(id: string): void {
  const all = readJSON<Record<string, AcademyScholarshipRow>>(SCHOLARSHIPS_KEY, {});
  delete all[id];
  writeJSON(SCHOLARSHIPS_KEY, all);
}

export interface LocalScholarshipFilters {
  query?: string;
  country?: string;
  degree?: string;
  fundingLevel?: string;
  studyField?: string;
  language?: string;
  category?: string;
  sort?: "deadline" | "new" | "funding";
}

export function searchScholarshipsLocal(filters: LocalScholarshipFilters = {}): AcademyScholarshipRow[] {
  let results = getAllScholarshipsLocal();

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((s) => s.title.toLowerCase().includes(q) || s.provider.toLowerCase().includes(q));
  }
  if (filters.country) results = results.filter((s) => s.country === filters.country);
  if (filters.degree) results = results.filter((s) => s.degree === filters.degree);
  if (filters.fundingLevel) results = results.filter((s) => s.funding_level === filters.fundingLevel);
  if (filters.studyField) results = results.filter((s) => s.study_fields.includes(filters.studyField!));
  if (filters.language) results = results.filter((s) => s.language === filters.language);
  if (filters.category) results = results.filter((s) => s.category === filters.category);

  if (filters.sort === "deadline") {
    results = [...results].sort((a, b) => (a.deadline ? new Date(a.deadline).getTime() : Infinity) - (b.deadline ? new Date(b.deadline).getTime() : Infinity));
  } else if (filters.sort === "new") {
    results = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return results;
}

export function getAllScholarshipCountries(): string[] {
  return Array.from(new Set(getAllScholarshipsLocal().map((s) => s.country))).filter(Boolean);
}

// ── Personalization ───────────────────────────────────────────────────────────

export function getSavedScholarshipIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(SAVED_KEY, {});
  return all[userId] ?? [];
}

export function toggleSavedScholarshipLocal(userId: string, scholarshipId: string): boolean {
  const all = readJSON<Record<string, string[]>>(SAVED_KEY, {});
  const current = all[userId] ?? [];
  const isSaved = current.includes(scholarshipId);
  all[userId] = isSaved ? current.filter((id) => id !== scholarshipId) : [...current, scholarshipId];
  writeJSON(SAVED_KEY, all);
  return !isSaved;
}

export function recordScholarshipViewLocal(userId: string, scholarshipId: string): void {
  const all = readJSON<Record<string, Record<string, string>>>(VIEWS_KEY, {});
  all[userId] = { ...(all[userId] ?? {}), [scholarshipId]: new Date().toISOString() };
  writeJSON(VIEWS_KEY, all);
}

export function getRecentlyViewedScholarships(userId: string, limit = 10): AcademyScholarshipRow[] {
  const all = readJSON<Record<string, Record<string, string>>>(VIEWS_KEY, {});
  const views = all[userId] ?? {};
  return Object.entries(views)
    .sort(([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, limit)
    .map(([id]) => getScholarshipByIdLocal(id))
    .filter((s): s is AcademyScholarshipRow => s !== null);
}

export function createDeadlineReminderLocal(userId: string, scholarshipId: string, remindDaysBefore: number): AcademyScholarshipReminderRow {
  const all = readJSON<AcademyScholarshipReminderRow[]>(REMINDERS_KEY, []);
  const reminder: AcademyScholarshipReminderRow = {
    id: crypto.randomUUID(), user_id: userId, scholarship_id: scholarshipId, remind_days_before: remindDaysBefore, created_at: new Date().toISOString(),
  };
  all.push(reminder);
  writeJSON(REMINDERS_KEY, all);
  return reminder;
}

export function getDeadlineRemindersLocal(userId: string): AcademyScholarshipReminderRow[] {
  const all = readJSON<AcademyScholarshipReminderRow[]>(REMINDERS_KEY, []);
  return all.filter((r) => r.user_id === userId);
}
