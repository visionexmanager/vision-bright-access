import { Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function AutoSaveIndicator({ saving }: { saving: boolean }) {
  const { t } = useLanguage();
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5 text-kids-green" aria-hidden="true" />}
      {saving ? t("kids.studio.saving") : t("kids.studio.saved")}
    </span>
  );
}
