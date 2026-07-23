import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStudioBookDetail } from "@/hooks/library/useStudioBookDetail";
import { useStudioAnalytics } from "@/hooks/library/useStudioAnalytics";
import { ReadersChart } from "@/components/library/studio/analytics/ReadersChart";
import { RevenueChart } from "@/components/library/studio/analytics/RevenueChart";
import { CompletionRateChart } from "@/components/library/studio/analytics/CompletionRateChart";
import { GeoDeviceBreakdown } from "@/components/library/studio/analytics/GeoDeviceBreakdown";

export default function LibraryStudioAnalytics() {
  const { t } = useLanguage();
  const { bookId } = useParams<{ bookId: string }>();
  const { book } = useStudioBookDetail(bookId);
  const { analytics, isLoading } = useStudioAnalytics(bookId, 30);

  useDocumentHead({ title: book ? `${t("library.studio.analytics.title")} — ${book.title}` : t("library.studio.analytics.title") });

  return (
    <Layout>
      <LibraryLayout title={t("library.studio.analytics.title")} breadcrumb={bookId ? [{ label: t("library.studio.dashboard.title"), to: "/library/studio" }, { label: book?.title ?? "…", to: `/library/studio/books/${bookId}` }, { label: t("library.studio.analytics.title") }] : undefined}>
        {isLoading || !analytics ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ReadersChart series={analytics.dailySeries} />
              <RevenueChart series={analytics.dailySeries} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
              <CompletionRateChart completionRate={analytics.completionRate} readingMinutes={analytics.readingMinutes} />
              <GeoDeviceBreakdown countries={analytics.countries} devices={analytics.devices} trafficSources={analytics.trafficSources} />
            </div>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
