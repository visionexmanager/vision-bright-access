import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { StudioEditorShell } from "@/components/library/studio/editor/StudioEditorShell";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStudioBookDetail } from "@/hooks/library/useStudioBookDetail";

export default function LibraryStudioEditor() {
  const { t } = useLanguage();
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const { book } = useStudioBookDetail(bookId);

  useDocumentHead({ title: book ? `${t("library.studio.editor.title")} — ${book.title}` : t("library.studio.editor.title") });

  if (!bookId || !chapterId) return null;

  return (
    <Layout>
      <LibraryLayout title={t("library.studio.editor.title")}>
        <div className="mb-4">
          <Link to={`/library/studio/books/${bookId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {book?.title ?? t("library.studio.editor.backToBook")}
          </Link>
        </div>
        <StudioEditorShell bookId={bookId} chapterId={chapterId} />
      </LibraryLayout>
    </Layout>
  );
}
