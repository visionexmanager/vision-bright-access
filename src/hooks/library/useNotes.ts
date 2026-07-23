/**
 * useNotes — a book's notes for the signed-in viewer, with add/edit/delete,
 * pinning, tags, notebook organization, and in-notes search. RLS: user
 * manages own rows.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchNotes, createNote, updateNote, deleteNote, searchNotes,
  toggleNotePinned, updateNoteTags, moveNoteToNotebook, type CreateNoteInput,
} from "@/services/library/notes";
import type { LibrarySmartNoteRow } from "@/lib/types/library-learning";

export function useNotes(bookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id ?? "";
  const [searchResults, setSearchResults] = useState<LibrarySmartNoteRow[] | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.notes(bookId ?? "", uid),
    queryFn: () => fetchNotes(uid, bookId!),
    enabled: !!bookId && !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.library.notes(bookId ?? "", uid) });
  }, [queryClient, bookId, uid]);

  const addNote = useCallback(
    async (pageNumber: number | null, content: string, opts: CreateNoteInput = {}) => {
      if (!bookId || !user || !content.trim()) return;
      try {
        await createNote(uid, bookId, pageNumber, content.trim(), opts);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't add note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [bookId, user, uid, invalidate]
  );

  const editNote = useCallback(
    async (noteId: string, content: string) => {
      try {
        await updateNote(noteId, content.trim());
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      try {
        await deleteNote(noteId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't delete note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const togglePin = useCallback(
    async (noteId: string, isPinned: boolean) => {
      try {
        await toggleNotePinned(noteId, isPinned);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const setTags = useCallback(
    async (noteId: string, tags: string[]) => {
      try {
        await updateNoteTags(noteId, tags);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't update tags", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const moveToNotebook = useCallback(
    async (noteId: string, notebookId: string | null) => {
      try {
        await moveNoteToNotebook(noteId, notebookId);
        invalidate();
      } catch (err) {
        toast({ title: "Couldn't move note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [invalidate]
  );

  const search = useCallback(
    async (query: string) => {
      if (!user || !query.trim()) {
        setSearchResults(null);
        return;
      }
      try {
        const results = await searchNotes(uid, query);
        setSearchResults(bookId ? results.filter((n) => n.book_id === bookId) : results);
      } catch (err) {
        toast({ title: "Search failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      }
    },
    [user, uid, bookId]
  );

  return { notes: searchResults ?? notes, isLoading, addNote, editNote, removeNote, togglePin, setTags, moveToNotebook, search };
}
