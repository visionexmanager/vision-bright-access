import { NotesPanel } from "@/components/library/reader/panels/NotesPanel";

interface NotesTabProps {
  bookId: string;
  currentPage: number | null;
}

/** Thin wrapper — reuses the existing Phase 6 NotesPanel as-is, just given
 *  a home inside the new tabbed AI sidebar's "Notes" tab. */
export function NotesTab({ bookId, currentPage }: NotesTabProps) {
  return <NotesPanel bookId={bookId} currentPage={currentPage} />;
}
