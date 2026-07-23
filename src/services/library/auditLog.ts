// ─── Library — Audit Log (Phase 11) ────────────────────────────────────────
// Thin wrapper around log_library_audit_event() — actor_id is always the
// caller's own auth.uid(), set server-side, never client-supplied. Errors
// are swallowed (logged to console) so a failed audit write never blocks
// the real action it's describing.

import { supabase } from "@/integrations/supabase/client";

export async function logLibraryAuditEvent(action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabase.rpc("log_library_audit_event", {
    _action: action,
    _entity_type: entityType,
    _entity_id: entityId,
    _metadata: metadata,
  });
  if (error) console.error(`Failed to log audit event "${action}":`, error.message);
}

export interface LibraryAuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Admin-only read (enforced by the "audit_logs: admin reads" RLS policy —
 *  a non-admin caller simply gets an empty result, not an error). */
export async function fetchAuditLogs(limit = 100): Promise<LibraryAuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryAuditLogRow[];
}
