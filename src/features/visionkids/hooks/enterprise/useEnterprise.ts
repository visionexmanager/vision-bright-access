import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as orgs from "@/features/visionkids/services/enterprise/orgs";
import * as academics from "@/features/visionkids/services/enterprise/academics";
import * as comm from "@/features/visionkids/services/enterprise/communication";
import type { OrgKind, OrgRole } from "@/features/visionkids/types/enterprise.types";

// ── Orgs ─────────────────────────────────────────────────────────────────────
export function useMyMemberships() {
  return useQuery({ queryKey: ["kids-ent", "memberships"], queryFn: orgs.fetchMyMemberships });
}
export function useOrg(id: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "org", id], queryFn: () => orgs.fetchOrg(id!), enabled: !!id });
}
export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, kind, slug }: { name: string; kind: OrgKind; slug: string }) => orgs.createOrg(name, kind, slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "memberships"] }),
  });
}
export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof orgs.updateOrg>[1] }) => orgs.updateOrg(id, patch),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["kids-ent", "org", v.id] }),
  });
}
export function useMembers(orgId: string | undefined, role?: OrgRole) {
  return useQuery({ queryKey: ["kids-ent", "members", orgId, role ?? "all"], queryFn: () => orgs.fetchMembers(orgId!, role), enabled: !!orgId });
}
export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId, role, displayName }: { orgId: string; userId: string; role: OrgRole; displayName?: string }) =>
      orgs.addMember(orgId, userId, role, displayName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "members"] }),
  });
}
export function useSchools(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "schools", orgId], queryFn: () => orgs.fetchSchools(orgId!), enabled: !!orgId });
}
export function useSchoolDashboard(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "dashboard", orgId], queryFn: () => orgs.fetchDashboard(orgId!), enabled: !!orgId });
}
export function useOrgAnalytics(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "analytics", orgId], queryFn: () => orgs.fetchAnalytics(orgId!), enabled: !!orgId });
}

// ── Academics ────────────────────────────────────────────────────────────────
export function useClasses(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "classes", orgId], queryFn: () => academics.fetchClasses(orgId!), enabled: !!orgId });
}
export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: academics.createClass, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "classes"] }) });
}
export function useClassRoster(classId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "roster", classId], queryFn: () => academics.fetchClassRoster(classId!), enabled: !!classId });
}
export function useAttendance(classId: string | undefined, date: string) {
  return useQuery({ queryKey: ["kids-ent", "attendance", classId, date], queryFn: () => academics.fetchAttendance(classId!, date), enabled: !!classId });
}
export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ classId, studentId, date, status }: { classId: string; studentId: string; date: string; status: import("@/features/visionkids/types/enterprise.types").AttendanceStatus }) =>
      academics.markAttendance(classId, studentId, date, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "attendance"] }),
  });
}
export function useAssignments(orgId: string | undefined, classId?: string) {
  return useQuery({ queryKey: ["kids-ent", "assignments", orgId, classId ?? "all"], queryFn: () => academics.fetchAssignments(orgId!, classId), enabled: !!orgId });
}
export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: academics.createAssignment, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "assignments"] }) });
}
export function useTimetable(classId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "timetable", classId], queryFn: () => academics.fetchTimetable(classId!), enabled: !!classId });
}
export function useCreateTimetableEntry() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: academics.createTimetableEntry, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "timetable"] }) });
}
export function useExams(orgId: string | undefined, classId?: string) {
  return useQuery({ queryKey: ["kids-ent", "exams", orgId, classId ?? "all"], queryFn: () => academics.fetchExams(orgId!, classId), enabled: !!orgId });
}
export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: academics.createExam, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "exams"] }) });
}

// ── Communication / resources / certificates ─────────────────────────────────
export function useAnnouncements(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "announcements", orgId], queryFn: () => comm.fetchAnnouncements(orgId!), enabled: !!orgId });
}
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: comm.createAnnouncement, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "announcements"] }) });
}
export function useResources(orgId: string | undefined, type?: string) {
  return useQuery({ queryKey: ["kids-ent", "resources", orgId, type ?? "all"], queryFn: () => comm.fetchResources(orgId!, type), enabled: !!orgId });
}
export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: comm.createResource, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "resources"] }) });
}
export function useCertificates(orgId: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "certificates", orgId], queryFn: () => comm.fetchCertificates(orgId!), enabled: !!orgId });
}
export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: comm.issueCertificate, onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-ent", "certificates"] }) });
}
export function useVerifyCertificate(code: string | undefined) {
  return useQuery({ queryKey: ["kids-ent", "verify", code], queryFn: () => comm.verifyCertificate(code!), enabled: !!code });
}
