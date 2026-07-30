import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as monitoring from "@/features/visionkids/services/ops/monitoring";
import * as admin from "@/features/visionkids/services/ops/admin";
import type { ErrorKind, IncidentStatus, LogLevel, ReportKind, Severity } from "@/features/visionkids/types/ops.types";

export function useIsAdmin() {
  return useQuery({ queryKey: ["kids-ops", "is-admin"], queryFn: monitoring.isAdmin });
}
export function useOpsOverview() {
  return useQuery({ queryKey: ["kids-ops", "overview"], queryFn: monitoring.fetchOverview });
}
export function useOpsErrors(kind?: ErrorKind) {
  return useQuery({ queryKey: ["kids-ops", "errors", kind ?? "all"], queryFn: () => monitoring.fetchErrors(kind) });
}
export function useResolveError() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => monitoring.resolveError(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ops", "errors"] }) });
}
export function useOpsReviews(status = "pending") {
  return useQuery({ queryKey: ["kids-ops", "reviews", status], queryFn: () => monitoring.fetchReviews(status) });
}
export function useDecideReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, notes }: { id: string; approve: boolean; notes?: string }) => monitoring.decideReview(id, approve, notes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-ops", "reviews"] }); qc.invalidateQueries({ queryKey: ["kids-ops", "overview"] }); },
  });
}
export function useOpsReports(kind: ReportKind) {
  return useQuery({ queryKey: ["kids-ops", "reports", kind], queryFn: () => monitoring.fetchReports(kind) });
}
export function useOpsHealth() {
  return useQuery({ queryKey: ["kids-ops", "health"], queryFn: monitoring.fetchHealth });
}
export function useOpsLogs(level?: LogLevel, search?: string) {
  return useQuery({ queryKey: ["kids-ops", "logs", level ?? "all", search ?? ""], queryFn: () => monitoring.fetchLogs(level, search) });
}

export function useIncidents() {
  return useQuery({ queryKey: ["kids-ops", "incidents"], queryFn: admin.fetchIncidents });
}
export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description, severity, area }: { title: string; description: string; severity: Severity; area?: string }) =>
      admin.createIncident(title, description, severity, area),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-ops", "incidents"] }); qc.invalidateQueries({ queryKey: ["kids-ops", "overview"] }); },
  });
}
export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: IncidentStatus }) => admin.updateIncident(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-ops", "incidents"] }); qc.invalidateQueries({ queryKey: ["kids-ops", "overview"] }); },
  });
}
export function useFlags() {
  return useQuery({ queryKey: ["kids-ops", "flags"], queryFn: admin.fetchFlags });
}
export function useToggleFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => admin.toggleFlag(key, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ops", "flags"] }),
  });
}
export function useReleases() {
  return useQuery({ queryKey: ["kids-ops", "releases"], queryFn: admin.fetchReleases });
}
export function useOpsAudit() {
  return useQuery({ queryKey: ["kids-ops", "audit"], queryFn: admin.fetchAudit });
}
export function useMaintenance() {
  return useQuery({ queryKey: ["kids-ops", "maintenance"], queryFn: admin.fetchMaintenance });
}
export function useSetMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: admin.setMaintenance,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-ops", "maintenance"] }); qc.invalidateQueries({ queryKey: ["kids-ops", "overview"] }); },
  });
}
