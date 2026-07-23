import { ChaptersList } from "@/components/library/ChaptersList";

interface TocPanelProps {
  bookId: string;
  currentPage: number | null;
  canAccessContent: boolean;
  onSelectChapter: (chapterId: string) => void;
}

export function TocPanel({ bookId, currentPage, canAccessContent, onSelectChapter }: TocPanelProps) {
  return <ChaptersList bookId={bookId} currentPage={currentPage} canAccessContent={canAccessContent} onSelectChapter={onSelectChapter} />;
}
