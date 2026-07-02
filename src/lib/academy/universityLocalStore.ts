/**
 * Academy — Universities Directory Local Store (Phase 5, temporary)
 * Same contract as libraryLocalStore.ts: no pre-seeded university data,
 * directory starts empty and is populated via AdminUniversities.tsx.
 */

import type { AcademyUniversityRow } from "@/lib/types/academy-modules";
import type { AcademyUniversityReviewRow } from "@/lib/types/academy-university";
import { readJSON, writeJSON } from "./localStorageUtils";

const UNIVERSITIES_KEY = "academy:universities";
const FAVORITES_KEY = "academy:favorite-universities";
const VIEWS_KEY = "academy:university-views";
const REVIEWS_KEY = "academy:university-reviews";

// ── Universities (admin-authored directory) ───────────────────────────────────

export function getAllUniversitiesLocal(): AcademyUniversityRow[] {
  return Object.values(readJSON<Record<string, AcademyUniversityRow>>(UNIVERSITIES_KEY, {}));
}

export function getUniversityByIdLocal(id: string): AcademyUniversityRow | null {
  return readJSON<Record<string, AcademyUniversityRow>>(UNIVERSITIES_KEY, {})[id] ?? null;
}

export function createUniversityLocal(data: Partial<AcademyUniversityRow>): AcademyUniversityRow {
  const all = readJSON<Record<string, AcademyUniversityRow>>(UNIVERSITIES_KEY, {});
  const id = `local-university-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const university: AcademyUniversityRow = {
    id,
    name: data.name ?? "جامعة بدون اسم",
    country: data.country ?? "",
    city: data.city ?? null,
    programs: data.programs ?? [],
    website_url: data.website_url ?? null,
    logo_url: null,
    image_urls: [],
    description: data.description ?? null,
    ranking_global: data.ranking_global ?? null,
    ranking_national: data.ranking_national ?? null,
    degrees_offered: data.degrees_offered ?? [],
    faculties: data.faculties ?? [],
    admission_requirements: data.admission_requirements ?? null,
    tuition_fee_range: data.tuition_fee_range ?? null,
    has_scholarships: data.has_scholarships ?? false,
    languages_of_instruction: data.languages_of_instruction ?? [],
    international_students_percent: data.international_students_percent ?? null,
    student_life_description: data.student_life_description ?? null,
    facilities: data.facilities ?? [],
    rating_avg: null,
    rating_count: 0,
    created_at: now,
    updated_at: now,
  };
  all[id] = university;
  writeJSON(UNIVERSITIES_KEY, all);
  return university;
}

export function updateUniversityLocal(id: string, updates: Partial<AcademyUniversityRow>): AcademyUniversityRow | null {
  const all = readJSON<Record<string, AcademyUniversityRow>>(UNIVERSITIES_KEY, {});
  const existing = all[id];
  if (!existing) return null;
  const next = { ...existing, ...updates, updated_at: new Date().toISOString() };
  all[id] = next;
  writeJSON(UNIVERSITIES_KEY, all);
  return next;
}

export function deleteUniversityLocal(id: string): void {
  const all = readJSON<Record<string, AcademyUniversityRow>>(UNIVERSITIES_KEY, {});
  delete all[id];
  writeJSON(UNIVERSITIES_KEY, all);
}

export interface LocalUniversityFilters {
  query?: string;
  country?: string;
  program?: string;
  sort?: "ranking" | "name" | "new";
}

export function searchUniversitiesLocal(filters: LocalUniversityFilters = {}): AcademyUniversityRow[] {
  let results = getAllUniversitiesLocal();

  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((u) => u.name.toLowerCase().includes(q) || (u.description ?? "").toLowerCase().includes(q));
  }
  if (filters.country) results = results.filter((u) => u.country === filters.country);
  if (filters.program) results = results.filter((u) => u.programs.includes(filters.program!));

  if (filters.sort === "ranking") {
    results = [...results].sort((a, b) => (a.ranking_global ?? Infinity) - (b.ranking_global ?? Infinity));
  } else if (filters.sort === "name") {
    results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  } else if (filters.sort === "new") {
    results = [...results].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return results;
}

export function getAllUniversityCountries(): string[] {
  return Array.from(new Set(getAllUniversitiesLocal().map((u) => u.country))).filter(Boolean);
}

// ── Personalization ───────────────────────────────────────────────────────────

export function getFavoriteUniversityIds(userId: string): string[] {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  return all[userId] ?? [];
}

export function toggleFavoriteUniversityLocal(userId: string, universityId: string): boolean {
  const all = readJSON<Record<string, string[]>>(FAVORITES_KEY, {});
  const current = all[userId] ?? [];
  const isFavorite = current.includes(universityId);
  all[userId] = isFavorite ? current.filter((id) => id !== universityId) : [...current, universityId];
  writeJSON(FAVORITES_KEY, all);
  return !isFavorite;
}

export function recordUniversityViewLocal(userId: string, universityId: string): void {
  const all = readJSON<Record<string, Record<string, string>>>(VIEWS_KEY, {});
  all[userId] = { ...(all[userId] ?? {}), [universityId]: new Date().toISOString() };
  writeJSON(VIEWS_KEY, all);
}

export function getRecentlyViewedUniversities(userId: string, limit = 10): AcademyUniversityRow[] {
  const all = readJSON<Record<string, Record<string, string>>>(VIEWS_KEY, {});
  const views = all[userId] ?? {};
  return Object.entries(views)
    .sort(([, a], [, b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, limit)
    .map(([id]) => getUniversityByIdLocal(id))
    .filter((u): u is AcademyUniversityRow => u !== null);
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export function getUniversityReviewsLocal(universityId: string): AcademyUniversityReviewRow[] {
  const all = readJSON<AcademyUniversityReviewRow[]>(REVIEWS_KEY, []);
  return all.filter((r) => r.university_id === universityId);
}

export function addUniversityReviewLocal(userId: string, universityId: string, rating: 1 | 2 | 3 | 4 | 5, comment: string | null): AcademyUniversityReviewRow {
  const all = readJSON<AcademyUniversityReviewRow[]>(REVIEWS_KEY, []);
  const review: AcademyUniversityReviewRow = { id: crypto.randomUUID(), user_id: userId, university_id: universityId, rating, comment, created_at: new Date().toISOString() };
  all.push(review);
  writeJSON(REVIEWS_KEY, all);

  const ratings = all.filter((r) => r.university_id === universityId).map((r) => r.rating);
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  updateUniversityLocal(universityId, { rating_avg: Math.round(avg * 10) / 10, rating_count: ratings.length });

  return review;
}
