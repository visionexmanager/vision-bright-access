import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchGroupSharedNotes, createGroupSharedNote, deleteGroupSharedNote,
  fetchGroupAssignments, createGroupAssignment,
  fetchAssignmentSubmissions, submitAssignment, uploadAssignmentFile,
  fetchPeerReviews, submitPeerReview, fetchTeacherFeedback, submitTeacherFeedback,
} from "@/services/library/groupLearning";

export function useGroupSharedNotes(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.groupSharedNotes(clubId ?? ""),
    queryFn: () => fetchGroupSharedNotes(clubId!),
    enabled: !!clubId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.groupSharedNotes(clubId ?? "") });

  const addNote = async (content: string) => {
    if (!clubId || !user || !content.trim()) return;
    try {
      await createGroupSharedNote(clubId, user.id, content.trim());
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't post note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeNote = async (noteId: string) => {
    try {
      await deleteGroupSharedNote(noteId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { notes, isLoading, addNote, removeNote };
}

export function useGroupAssignments(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: queryKeys.library.groupAssignments(clubId ?? ""),
    queryFn: () => fetchGroupAssignments(clubId!),
    enabled: !!clubId,
  });

  const createAssignment = async (title: string, description: string | null, dueAt: string | null) => {
    if (!clubId || !user || !title.trim()) return;
    try {
      await createGroupAssignment(clubId, user.id, title.trim(), description, dueAt);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.groupAssignments(clubId) });
    } catch (err) {
      toast({ title: "Couldn't create assignment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { assignments, isLoading, createAssignment };
}

export function useAssignmentSubmissions(assignmentId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: queryKeys.library.groupSubmissions(assignmentId ?? ""),
    queryFn: () => fetchAssignmentSubmissions(assignmentId!),
    enabled: !!assignmentId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.groupSubmissions(assignmentId ?? "") });

  const submit = async (content: string | null, file?: File | null) => {
    if (!assignmentId || !user) return;
    try {
      let fileUrl: string | null = null;
      if (file) fileUrl = await uploadAssignmentFile(user.id, file);
      await submitAssignment(assignmentId, user.id, content, fileUrl);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't submit", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { submissions, isLoading, submit, mySubmission: submissions.find((s) => s.user_id === user?.id) };
}

export function usePeerReviews(submissionId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: queryKeys.library.groupPeerReviews(submissionId ?? ""),
    queryFn: () => fetchPeerReviews(submissionId!),
    enabled: !!submissionId,
  });

  const review = async (rating: number, feedback: string | null) => {
    if (!submissionId || !user) return;
    try {
      await submitPeerReview(submissionId, user.id, rating, feedback);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.groupPeerReviews(submissionId) });
    } catch (err) {
      toast({ title: "Couldn't submit review", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { reviews, review };
}

export function useTeacherFeedback(submissionId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: feedback = [] } = useQuery({
    queryKey: queryKeys.library.groupTeacherFeedback(submissionId ?? ""),
    queryFn: () => fetchTeacherFeedback(submissionId!),
    enabled: !!submissionId,
  });

  const giveFeedback = async (feedbackText: string, grade: string | null) => {
    if (!submissionId || !user) return;
    try {
      await submitTeacherFeedback(submissionId, user.id, feedbackText, grade);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.groupTeacherFeedback(submissionId) });
    } catch (err) {
      toast({ title: "Couldn't submit feedback", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { feedback, giveFeedback };
}
