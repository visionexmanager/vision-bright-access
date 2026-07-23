import { useEffect } from "react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BooksExplorerPanel } from "@/components/library/BooksExplorerPanel";
import { RecentlyViewedRail } from "@/components/library/RecentlyViewedRail";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";

export default function LibraryBooksExplorer() {
  const { t } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    void logLibraryAnalyticsEvent("page_view", { userId: user?.id ?? null, entityType: "explorer" });
    // Log once per page mount — filter/sort changes are logged separately
    // (debounced) by BooksExplorerPanel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDocumentHead({
    title: `${t("library.explorer.title")} — Visionex Library`,
    description: t("library.explorer.description"),
    canonicalPath: "/library/books",
  });

  return (
    <Layout>
      <LibraryLayout title={t("library.explorer.title")} breadcrumb={[{ label: t("library.explorer.title") }]}>
        <RecentlyViewedRail />
        <BooksExplorerPanel />
      </LibraryLayout>
    </Layout>
  );
}
