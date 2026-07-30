import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import * as groups from "@/features/visionkids/services/social/groups";
import type { SocialGroupType } from "@/features/visionkids/types/social.types";

export function useGroups(groupType?: SocialGroupType | SocialGroupType[]) {
  const key = Array.isArray(groupType) ? groupType.join(",") : groupType ?? "all";
  return useQuery({ queryKey: ["kids-social", "groups", key], queryFn: () => groups.fetchGroups(groupType) });
}

export function useGroupBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "group", slug], queryFn: () => groups.fetchGroupBySlug(slug!), enabled: !!slug });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: groups.CreateGroupInput) => groups.createGroup(input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kids-social", "groups"] }); qc.invalidateQueries({ queryKey: ["kids-social", "my-memberships"] }); },
  });
}

export function useGroupMembers(groupId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "group-members", groupId], queryFn: () => groups.fetchGroupMembers(groupId!), enabled: !!groupId });
}

export function useMyGroupMemberships() {
  return useQuery({ queryKey: ["kids-social", "my-memberships"], queryFn: groups.fetchMyGroupMemberships });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groups.joinGroup(groupId),
    onSuccess: (_d, groupId) => {
      qc.invalidateQueries({ queryKey: ["kids-social", "group-members", groupId] });
      qc.invalidateQueries({ queryKey: ["kids-social", "my-memberships"] });
      qc.invalidateQueries({ queryKey: ["kids", "achievements"] });
    },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groups.leaveGroup(groupId),
    onSuccess: (_d, groupId) => {
      qc.invalidateQueries({ queryKey: ["kids-social", "group-members", groupId] });
      qc.invalidateQueries({ queryKey: ["kids-social", "my-memberships"] });
    },
  });
}

export function useGroupMessages(groupId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!groupId) return;
    const channel = kidsDb
      .channel(`kids-group-messages-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kids_social_group_messages", filter: `group_id=eq.${groupId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-social", "group-messages", groupId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [groupId, qc]);

  return useQuery({ queryKey: ["kids-social", "group-messages", groupId], queryFn: () => groups.fetchGroupMessages(groupId!), enabled: !!groupId });
}

export function useSendGroupMessage(groupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => groups.sendGroupMessage(groupId!, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "group-messages", groupId] }),
  });
}

export function useGroupMaterials(groupId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "group-materials", groupId], queryFn: () => groups.fetchGroupMaterials(groupId!), enabled: !!groupId });
}

export function useUploadGroupMaterial(groupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title: string }) => groups.uploadGroupMaterial(groupId!, file, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "group-materials", groupId] }),
  });
}

export function useGroupAssignments(groupId: string | undefined) {
  return useQuery({ queryKey: ["kids-social", "group-assignments", groupId], queryFn: () => groups.fetchGroupAssignments(groupId!), enabled: !!groupId });
}

export function useCreateGroupAssignment(groupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description, dueAt }: { title: string; description?: string; dueAt?: string }) => groups.createGroupAssignment(groupId!, title, description, dueAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "group-assignments", groupId] }),
  });
}

export function useMyAssignmentSubmission(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ["kids-social", "assignment-submission", assignmentId],
    queryFn: () => groups.fetchMyAssignmentSubmission(assignmentId!),
    enabled: !!assignmentId,
  });
}

export function useSubmitAssignment(assignmentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => groups.submitAssignment(assignmentId!, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "assignment-submission", assignmentId] }),
  });
}
