import { Link } from "react-router-dom";
import { Route, Clock, Award, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryLearningPathRow } from "@/lib/types/library-learning";

interface LearningPathCardProps {
  path: LibraryLearningPathRow;
}

export function LearningPathCard({ path }: LearningPathCardProps) {
  const { t } = useLanguage();

  return (
    <Link to={`/library/learning-paths/${path.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Route className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{path.title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {path.description && <p className="line-clamp-2 text-sm text-muted-foreground">{path.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t(`library.learningPaths.level.${path.level}`)}</Badge>
            {path.is_certification_track && (
              <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.certificationBadge")}</Badge>
            )}
            {path.is_adaptive && (
              <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" /> {t("library.learningPaths.adaptiveBadge")}</Badge>
            )}
          </div>
          {path.estimated_minutes && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.learningPaths.estimatedTime").replace("{minutes}", String(path.estimated_minutes))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
