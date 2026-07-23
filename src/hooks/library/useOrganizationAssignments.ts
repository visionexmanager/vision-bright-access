import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchOrganizationAssignments, fetchMyAssignments, createOrganizationAssignment, deleteOrganizationAssignment,
  fetchAssignmentCompletions, markAssignmentComplete, issueAssignmentCertificate, type CreateAssignmentInput,
} from "@/services/library/organizationAssignments";

export function useOrganizationAssignments(orgId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationAssignments(orgId),
    queryFn: () => fetchOrganizationAssignments(orgId),
    enabled: !!orgId,
  });

  const { data: myAssignments = [] } = useQuery({
    queryKey: [...queryKeys.library.organizationAssignments(orgId), "mine", user?.id ?? ""],
    queryFn: () => fetchMyAssignments(orgId, user!.id),
    enabled: !!orgId && !!user,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationAssignments(orgId) });

  const create = async (input: CreateAssignmentInput) => {
    if (!user || !orgId) return null;
    try {
      const assignment = await createOrganizationAssignment(orgId, user.id, input);
      invalidate();
      toast({ title: "Assignment created" });
      return assignment;
    } catch (err) {
      toast({ title: "Couldn't create assignment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const remove = async (assignmentId: string) => {
    try {
      await deleteOrganizationAssignment(assignmentId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete assignment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const complete = async (assignmentId: string, scorePercent?: number) => {
    if (!user) return;
    try {
      await markAssignmentComplete(assignmentId, user.id, scorePercent);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.organizationAssignmentCompletions(assignmentId) });
      toast({ title: "Assignment marked complete" });
    } catch (err) {
      toast({ title: "Couldn't mark complete", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const issueCertificate = async (assignmentId: string) => {
    try {
      await issueAssignmentCertificate(assignmentId);
      toast({ title: "Certificate issued" });
    } catch (err) {
      toast({ title: "Couldn't issue certificate", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { assignments, myAssignments, isLoading, create, remove, complete, issueCertificate };
}

export function useAssignmentCompletions(assignmentId: string) {
  const { data: completions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.organizationAssignmentCompletions(assignmentId),
    queryFn: () => fetchAssignmentCompletions(assignmentId),
    enabled: !!assignmentId,
  });
  return { completions, isLoading };
}
