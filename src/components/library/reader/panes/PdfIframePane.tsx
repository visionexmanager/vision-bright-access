import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface PdfIframePaneProps {
  signedUrl: string | null;
  isLoadingUrl: boolean;
}

/**
 * Sandboxed native-browser PDF rendering — the fallback for books whose
 * only usable content is a raw PDF file (see the Phase 6 plan's confirmed
 * "text-first + native PDF fallback" architecture: no pdf.js/epub.js can be
 * installed or verified in this sandbox, so the browser's own PDF viewer
 * renders the page, wrapped in the same toolbar/bookmarks/notes/AI shell as
 * the reflowable pane). In-PDF search/highlight/precise-position-tracking
 * are NOT available here — the native viewer's own tools substitute.
 */
export function PdfIframePane({ signedUrl, isLoadingUrl }: PdfIframePaneProps) {
  const { t } = useLanguage();
  const [loadFailed, setLoadFailed] = useState(false);

  if (isLoadingUrl) {
    return (
      <div className="flex h-full items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t("library.reader.loadingFile")}</span>
      </div>
    );
  }

  if (!signedUrl || loadFailed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <p className="font-medium">{t("library.reader.pdfLoadFailedTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t("library.reader.pdfLoadFailedDesc")}</p>
      </div>
    );
  }

  return (
    <iframe
      title={t("library.reader.pdfIframeTitle")}
      src={signedUrl}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
      onError={() => setLoadFailed(true)}
    />
  );
}
