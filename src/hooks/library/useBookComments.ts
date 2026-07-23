/**
 * useBookComments — comment thread for a book/chapter, anchored to a
 * ProseMirror position range or left null for chapter/book-level notes.
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchComments, addComment, resolveComment, deleteComment } from "@/services/library/comments";

export function useBookComments(bookId: string | undefined, chapterId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: queryKeys.library.studio.comments(bookId ?? "", chapterId),
    queryFn: () => fetchComments(bookId!, chapterId),
    enabled: !!bookId,
  });

  const invalidate = useCallback(() => {
    if (bookId) void queryClient.invalidateQueries({ queryKey: queryKeys.library.studio.comments(bookId, chapterId) });
  }, [bookId, chapterId, queryClient]);

  const postComment = useCallback(
    async (body: string, anchor?: { from: number; to: number }, parentCommentId?: string) => {
      if (!bookId || !user || !body.trim()) return;
      await addComment({ book_id: bookId, chapter_id: chapterId, parent_comment_id: parentCommentId, author_id: user.id, body, anchor });
      invalidate();
    },
    [bookId, chapterId, user, invalidate]
  );

  const resolve = useCallback(async (commentId: string) => {
    await resolveComment(commentId);
    invalidate();
  }, [invalidate]);

  const remove = useCallback(async (commentId: string) => {
    await deleteComment(commentId);
    invalidate();
  }, [invalidate]);

  return { comments, isLoading, postComment, resolve, remove };
}
