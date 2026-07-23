// ─── Library — Learning Hub: Group Learning (study groups on top of clubs) ─

import { supabase } from "@/integrations/supabase/client";
import type {
  LibraryGroupSharedNoteRow, LibraryGroupAssignmentRow, LibraryGroupAssignmentSubmissionRow,
  LibraryGroupPeerReviewRow, LibraryGroupTeacherFeedbackRow,
} from "@/lib/types/library-learning";

export async function fetchGroupSharedNotes(clubId: string): Promise<LibraryGroupSharedNoteRow[]> {
  const { data, error } = await supabase.from("library_group_shared_notes").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryGroupSharedNoteRow[];
}

export async function createGroupSharedNote(clubId: string, userId: string, content: string): Promise<void> {
  const { error } = await supabase.from("library_group_shared_notes").insert({ club_id: clubId, user_id: userId, content });
  if (error) throw new Error(error.message);
}

export async function deleteGroupSharedNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("library_group_shared_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}

export async function fetchGroupAssignments(clubId: string): Promise<LibraryGroupAssignmentRow[]> {
  const { data, error } = await supabase.from("library_group_assignments").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryGroupAssignmentRow[];
}

export async function createGroupAssignment(clubId: string, userId: string, title: string, description: string | null, dueAt: string | null): Promise<void> {
  const { error } = await supabase.from("library_group_assignments").insert({ club_id: clubId, created_by: userId, title, description, due_at: dueAt });
  if (error) throw new Error(error.message);
}

export async function fetchAssignmentSubmissions(assignmentId: string): Promise<LibraryGroupAssignmentSubmissionRow[]> {
  const { data, error } = await supabase.from("library_group_assignment_submissions").select("*").eq("assignment_id", assignmentId).order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryGroupAssignmentSubmissionRow[];
}

export async function submitAssignment(assignmentId: string, userId: string, content: string | null, fileUrl: string | null): Promise<void> {
  const { error } = await supabase
    .from("library_group_assignment_submissions")
    .upsert({ assignment_id: assignmentId, user_id: userId, content, file_url: fileUrl, submitted_at: new Date().toISOString() }, { onConflict: "assignment_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function uploadAssignmentFile(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("library-group-submissions").upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("library-group-submissions").getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchPeerReviews(submissionId: string): Promise<LibraryGroupPeerReviewRow[]> {
  const { data, error } = await supabase.from("library_group_peer_reviews").select("*").eq("submission_id", submissionId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryGroupPeerReviewRow[];
}

export async function submitPeerReview(submissionId: string, reviewerId: string, rating: number, feedback: string | null): Promise<void> {
  const { error } = await supabase.from("library_group_peer_reviews").insert({ submission_id: submissionId, reviewer_id: reviewerId, rating, feedback });
  if (error) throw new Error(error.message);
}

export async function fetchTeacherFeedback(submissionId: string): Promise<LibraryGroupTeacherFeedbackRow[]> {
  const { data, error } = await supabase.from("library_group_teacher_feedback").select("*").eq("submission_id", submissionId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibraryGroupTeacherFeedbackRow[];
}

export async function submitTeacherFeedback(submissionId: string, instructorId: string, feedback: string, grade: string | null): Promise<void> {
  const { error } = await supabase.from("library_group_teacher_feedback").insert({ submission_id: submissionId, instructor_id: instructorId, feedback, grade });
  if (error) throw new Error(error.message);
}
