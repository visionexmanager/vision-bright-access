import { useLanguage } from "@/contexts/LanguageContext";
import { ReaderErrorState } from "@/components/library/reader/ReaderErrorState";

interface UnsupportedFormatPaneProps {
  bookId: string;
  fileType: string | null;
}

/** DOCX (no parser exists anywhere in this codebase) or any file with no
 *  extractable chapter content and no usable raw-format fallback — the
 *  user's own explicitly-requested behavior for this case: a clear reason
 *  + suggestion, not a hack. */
export function UnsupportedFormatPane({ bookId, fileType }: UnsupportedFormatPaneProps) {
  const { t } = useLanguage();
  return (
    <ReaderErrorState
      bookId={bookId}
      reason={fileType ? t("library.reader.unsupportedFormatTitle").replace("{format}", fileType.toUpperCase()) : t("library.reader.noContentTitle")}
      suggestion={t("library.reader.unsupportedFormatDesc")}
      showDownloadSuggestion
    />
  );
}
