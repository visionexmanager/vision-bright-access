import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LoadingProps {
  label?: string;
  className?: string;
}

export function Loading({ label, className }: LoadingProps) {
  const { t } = useLanguage();
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground", className)} role="status" aria-live="polite">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm">{label ?? t("library.common.loading")}</span>
    </div>
  );
}
