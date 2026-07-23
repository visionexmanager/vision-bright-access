import { Link } from "react-router-dom";
import { Sparkles, RefreshCw, X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/library/EmptyState";
import { useLibrarianRecommendations } from "@/hooks/library/useLibrarianRecommendations";
import { recommendationLinkPath } from "@/services/library/librarianRecommendations";
import { useLanguage } from "@/contexts/LanguageContext";

export function RecommendationsFeed() {
  const { t } = useLanguage();
  const { recommendations, isLoading, isRegenerating, dismiss, regenerate } = useLibrarianRecommendations();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("library.librarian.recommendations.title")}
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={isRegenerating} onClick={() => void regenerate()}>
          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          {t("library.librarian.recommendations.refresh")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      ) : recommendations.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.librarian.recommendations.empty")} className="py-8" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((rec) => (
            <Card key={rec.id} className="flex flex-col gap-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline" className="text-xs">{t(`library.librarian.recommendations.type.${rec.recommendation_type}`)}</Badge>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => void dismiss(rec.id)} aria-label={t("library.librarian.recommendations.dismiss")}>
                  <X className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
              <Link to={recommendationLinkPath(rec)} className="text-sm font-medium hover:underline">{rec.title}</Link>
              {rec.reason && <p className="text-xs text-muted-foreground">{rec.reason}</p>}
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
