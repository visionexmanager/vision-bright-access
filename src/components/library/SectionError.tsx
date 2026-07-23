import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface SectionErrorProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** Functional, retry-capable error state for a data-fetching section —
 * modeled on AcademyErrorState.tsx. Distinct from the class-based
 * library/ErrorBoundary.tsx, which only catches render errors and can't be
 * wired to a query's refetch(). */
export function SectionError({ message, onRetry, className }: SectionErrorProps) {
  const { t } = useLanguage();
  return (
    <div role="alert" className={`flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-8 text-center ${className ?? ""}`}>
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("library.common.retry")}
        </Button>
      )}
    </div>
  );
}
