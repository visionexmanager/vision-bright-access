import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import type {
  Organization, OrgMember, School, MyMembership, SchoolDashboard, OrgAnalytics, OrgKind, OrgRole,
} from "@/features/visionkids/types/enterprise.types";

async function currentUserId(): Promise<string | null> {
  const { data } = await kidsDb.auth.getUser();
  return data.user?.id ?? null;
}

/** The organizations the caller belongs to, with their role. */
export async function fetchMyMemberships(): Promise<MyMembership[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const { data, error } = await kidsDb
    .from("kids_org_members")
    .select("*, kids_organizations(*)")
    .eq("user_id", userId).eq("status", "active")
    .returns<(OrgMember & { kids_organizations: Organization | Organization[] | null })[]>();
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { kids_organizations, ...member } = row;
    const organization = Array.isArray(kids_organizations) ? kids_organizations[0] ?? null : kids_organizations;
    return { ...(member as OrgMember), organization };
  });
}

export async function fetchOrg(id: string): Promise<Organization | null> {
  const { data, error } = await kidsDb.from("kids_organizations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Organization | null) ?? null;
}

export async function createOrg(name: string, kind: OrgKind, slug: string): Promise<string> {
  const { data, error } = await kidsDb.rpc("create_kids_org", { _name: name, _kind: kind, _slug: slug });
  if (error) throw error;
  return data as string;
}

export async function updateOrg(id: string, patch: Partial<Pick<Organization, "name" | "domain" | "logo_url" | "branding" | "settings">>): Promise<void> {
  const { error } = await kidsDb.from("kids_organizations").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchMembers(orgId: string, role?: OrgRole): Promise<OrgMember[]> {
  let query = kidsDb.from("kids_org_members").select("*").eq("org_id", orgId).eq("status", "active");
  if (role) query = query.eq("role", role);
  const { data, error } = await query.returns<OrgMember[]>();
  if (error) throw error;
  return data ?? [];
}

export async function addMember(orgId: string, userId: string, role: OrgRole, displayName?: string): Promise<void> {
  const { error } = await kidsDb.rpc("add_kids_org_member", { _org: orgId, _user_id: userId, _role: role, _display_name: displayName ?? null });
  if (error) throw error;
}

export async function fetchSchools(orgId: string): Promise<School[]> {
  const { data, error } = await kidsDb
    .from("kids_schools").select("*").eq("org_id", orgId).order("order_index")
    .returns<School[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchDashboard(orgId: string): Promise<SchoolDashboard> {
  const { data, error } = await kidsDb.rpc("get_kids_school_dashboard", { _org: orgId });
  if (error) throw error;
  return data as SchoolDashboard;
}

export async function fetchAnalytics(orgId: string): Promise<OrgAnalytics> {
  const { data, error } = await kidsDb.rpc("get_kids_org_analytics", { _org: orgId });
  if (error) throw error;
  return data as OrgAnalytics;
}
