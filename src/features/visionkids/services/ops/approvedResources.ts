import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { searchExternalContent } from "@/services/library/externalContent";
import {
  APPROVED_SOURCES, sourceById, toCandidate, validAgeRange, cleanText,
  type ApprovalCandidate, type CandidateProblem, type Subject,
} from "@/features/visionkids/data/approvedSources";

export interface ApprovedResource {
  id: string;
  source: string;
  provider_item_id: string;
  title: string;
  summary: string | null;
  url: string;
  license_name: string;
  license_url: string | null;
  attribution: string;
  age_min: number;
  age_max: number;
  subject: string;
  language: string;
  status: string;
  review_notes: string | null;
  updated_at: string;
}

const COLUMNS =
  "id, source, provider_item_id, title, summary, url, license_name, license_url, attribution, age_min, age_max, subject, language, status, review_notes, updated_at";

/** What a child may see: the database already hides disabled rows and switched-off sources. */
export async function fetchShelf(): Promise<ApprovedResource[]> {
  const { data, error } = await kidsDb
    .from("kids_approved_resources").select(COLUMNS).eq("status", "approved")
    .order("subject").order("age_min").order("title").limit(60);
  if (error) throw error;
  return data ?? [];
}

/** Administrators see every row, disabled ones included (RLS decides; a non-admin gets only the shelf). */
export async function fetchAllApproved(): Promise<ApprovedResource[]> {
  const { data, error } = await kidsDb
    .from("kids_approved_resources").select(COLUMNS).order("status").order("updated_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export interface CandidateResult { candidate: ApprovalCandidate }
export interface RejectedResult { title: string; problem: CandidateProblem }

/** Searches one allow-listed source and splits the hits into approvable candidates and refused ones. */
export async function searchCandidates(sourceId: string, query: string): Promise<{ candidates: ApprovalCandidate[]; refused: RejectedResult[] }> {
  const source = sourceById(sourceId);
  const text = cleanText(query, 100);
  if (!source || text.length < 2) return { candidates: [], refused: [] };
  const response = await searchExternalContent({ query: text, providers: [source.providerId], limit: 12, categories: ["books", "education"] });
  const candidates: ApprovalCandidate[] = [];
  const refused: RejectedResult[] = [];
  for (const item of response.items) {
    const result = toCandidate(item);
    if ("candidate" in result) candidates.push(result.candidate);
    else refused.push({ title: cleanText(item.title, 80), problem: (result as { problem: CandidateProblem }).problem });
  }
  return { candidates, refused };
}

export async function approveResource(
  candidate: ApprovalCandidate,
  review: { ageMin: number; ageMax: number; subject: Subject; notes?: string },
): Promise<void> {
  if (!APPROVED_SOURCES.some((s) => s.id === candidate.source)) throw new Error("source_not_allowed");
  if (!validAgeRange(review.ageMin, review.ageMax)) throw new Error("age_range_invalid");
  const { data: auth } = await kidsDb.auth.getUser();
  const { error } = await kidsDb.from("kids_approved_resources").upsert({
    ...candidate,
    age_min: review.ageMin,
    age_max: review.ageMax,
    subject: review.subject,
    review_notes: review.notes ? cleanText(review.notes, 500) : null,
    status: "approved",
    reviewed_by: auth.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source,provider_item_id" });
  if (error) throw error;
}

export async function setResourceStatus(id: string, status: "approved" | "disabled"): Promise<void> {
  const { error } = await kidsDb.from("kids_approved_resources")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
