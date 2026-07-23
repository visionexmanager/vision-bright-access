import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { QuoteCard } from "@/components/library/QuoteCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Quote } from "lucide-react";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchQuotes } from "@/services/library/quotes";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryQuotes() {
  const { t } = useLanguage();
  const { data: quotes = [], isLoading } = useQuery({
    queryKey: queryKeys.library.quotes(),
    queryFn: fetchQuotes,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.quotes")} breadcrumb={[{ label: t("library.nav.quotes") }]}>
        {isLoading ? (
          <SkeletonLoader variant="grid" count={6} />
        ) : quotes.length === 0 ? (
          <EmptyState icon={<Quote className="h-10 w-10" />} title={t("library.emptyState.noQuotesTitle")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {quotes.map((quote) => (
              <div role="listitem" key={quote.id}>
                <QuoteCard quote={quote} />
              </div>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
