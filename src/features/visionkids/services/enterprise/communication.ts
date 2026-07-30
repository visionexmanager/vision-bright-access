import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Announcement, OrgResource, OrgCertificate, CertificateVerification, AnnouncementKind, Audience, ResourceType,
} from "@/features/visionkids/types/enterprise.types";

// ── Announcements ────────────────────────────────────────────────────────────
export async function fetchAnnouncements(orgId: string): Promise<Announcement[]> {
  const { data, error } = await kidsDb
    .from("kids_org_announcements").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(50)
    .returns<Announcement[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createAnnouncement(input: { orgId: string; kind: AnnouncementKind; title: string; body?: string; audience: Audience; link?: string }): Promise<void> {
  const { data: auth } = await kidsDb.auth.getUser();
  const { error } = await kidsDb.from("kids_org_announcements").insert({
    org_id: input.orgId, kind: input.kind, title: input.title, body: input.body ?? null,
    audience: input.audience, link: input.link ?? null, author_id: auth.user?.id ?? null,
  });
  if (error) throw error;
}

// ── Resources ────────────────────────────────────────────────────────────────
export async function fetchResources(orgId: string, type?: string): Promise<OrgResource[]> {
  let query = kidsDb.from("kids_org_resources").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
  if (type && type !== "all") query = query.eq("type", type);
  const { data, error } = await query.returns<OrgResource[]>();
  if (error) throw error;
  return data ?? [];
}

export async function createResource(input: { orgId: string; type: ResourceType; title: string; description?: string; url?: string; emoji?: string; category?: string }): Promise<void> {
  const { data: auth } = await kidsDb.auth.getUser();
  const { error } = await kidsDb.from("kids_org_resources").insert({
    org_id: input.orgId, type: input.type, title: input.title, description: input.description ?? null,
    url: input.url ?? null, emoji: input.emoji ?? "📄", category: input.category ?? null, created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

// ── Certificates ─────────────────────────────────────────────────────────────
export async function fetchCertificates(orgId: string): Promise<OrgCertificate[]> {
  const { data, error } = await kidsDb
    .from("kids_org_certificates").select("*").eq("org_id", orgId).order("issued_at", { ascending: false }).limit(100)
    .returns<OrgCertificate[]>();
  if (error) throw error;
  return data ?? [];
}

export async function issueCertificate(input: { orgId: string; studentId: string; studentName: string; title: string; description?: string }): Promise<{ id: string; verify_code: string }> {
  const { data, error } = await kidsDb.rpc("issue_kids_certificate", {
    _org: input.orgId, _student_id: input.studentId, _student_name: input.studentName, _title: input.title, _description: input.description ?? null,
  });
  if (error) throw error;
  return data as { id: string; verify_code: string };
}

/** Public certificate verification by QR code — safe for anonymous callers. */
export async function verifyCertificate(code: string): Promise<CertificateVerification> {
  const { data, error } = await kidsDb.rpc("verify_kids_certificate", { _code: code });
  if (error) throw error;
  return data as CertificateVerification;
}
