import { Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface DownloadButtonProps {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function DownloadButton({ active, onToggle, className }: DownloadButtonProps) {
  const { t } = useLanguage();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? t("library.actions.removeDownload") : t("library.actions.download")}
      className={cn("shrink-0", className)}
    >
      {active ? <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
