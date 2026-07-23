// ─── Library — Enterprise Platform: Private Libraries & Resources ─────────
// Private storage bucket (`organization-resources`), objects live at
// `{organization_id}/{resource_id}/{filename}` — RLS alone decides access
// (organization_member_has_permission checked against the folder's org id),
// same signed-URL-only pattern as readerFiles.ts's private book-file buckets.

import { supabase } from "@/integrations/supabase/client";

export type OrganizationResourceType =
  | "collection" | "internal_document" | "training_manual" | "policy"
  | "employee_handbook" | "course_library" | "confidential_resource";

export interface OrganizationResourceRow {
  id: string;
  organization_id: string;
  resource_type: OrganizationResourceType;
  title: string;
  description: string | null;
  storage_path: string | null;
  book_id: string | null;
  group_id: string | null;
  is_confidential: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchOrganizationResources(orgId: string, resourceType?: OrganizationResourceType): Promise<OrganizationResourceRow[]> {
  let query = supabase.from("organization_resources").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (resourceType) query = query.eq("resource_type", resourceType);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as OrganizationResourceRow[];
}

export async function uploadOrganizationResourceFile(orgId: string, resourceId: string, file: File): Promise<string> {
  const path = `${orgId}/${resourceId}/${file.name}`;
  const { error } = await supabase.storage.from("organization-resources").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

export interface CreateResourceInput {
  resourceType: OrganizationResourceType;
  title: string;
  description?: string;
  bookId?: string;
  groupId?: string;
  isConfidential?: boolean;
}

/** File uploads generate the resource's id client-side and upload BEFORE
 *  inserting the row — the table's CHECK (storage_path IS NOT NULL OR
 *  book_id IS NOT NULL) means an insert-then-attach-file two-step would
 *  briefly violate the constraint (a bare row with neither set). */
export async function createOrganizationResource(orgId: string, createdBy: string, input: CreateResourceInput, file?: File): Promise<OrganizationResourceRow> {
  let storagePath: string | null = null;
  const resourceId = crypto.randomUUID();

  if (file) {
    storagePath = await uploadOrganizationResourceFile(orgId, resourceId, file);
  }

  const { data: resource, error } = await supabase
    .from("organization_resources")
    .insert({
      id: resourceId, organization_id: orgId, resource_type: input.resourceType, title: input.title,
      description: input.description || null, book_id: input.bookId || null, group_id: input.groupId || null,
      is_confidential: input.isConfidential ?? false, created_by: createdBy, storage_path: storagePath,
    })
    .select("*").single();
  if (error) throw new Error(error.message);
  return resource as OrganizationResourceRow;
}

export async function deleteOrganizationResource(resourceId: string): Promise<void> {
  const { data: resource } = await supabase.from("organization_resources").select("organization_id, title, is_confidential").eq("id", resourceId).maybeSingle();
  const { error } = await supabase.from("organization_resources").delete().eq("id", resourceId);
  if (error) throw new Error(error.message);
  if (resource) {
    await supabase.rpc("log_library_audit_event", {
      _action: "organization_resource_deleted", _entity_type: "organization", _entity_id: resource.organization_id,
      _metadata: { resource_id: resourceId, title: resource.title, was_confidential: resource.is_confidential },
    });
  }
}

export async function getSignedResourceUrl(storagePath: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from("organization-resources").createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.warn("Failed to sign organization-resources URL:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
