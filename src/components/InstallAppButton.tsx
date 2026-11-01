import { useState } from "react";
import { Download } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useInstallApp } from "@/hooks/useInstallApp";

/** Offers to install the whole site as an app; renders nothing where that is not possible. */
export function InstallAppButton() {
  const { t } = useLanguage();
  const { mode, install } = useInstallApp();
  const [showHint, setShowHint] = useState(false);

  if (mode === "none") return null;

  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button
        type="button"
        onClick={() => (mode === "prompt" ? void install() : setShowHint((shown) => !shown))}
        aria-expanded={mode === "ios" ? showHint : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Download aria-hidden="true" className="h-4 w-4" />
        {t("install.app.button")}
      </button>
      {mode === "ios" && showHint && (
        <p role="status" className="max-w-xs text-xs text-muted-foreground">
          {t("install.app.iosHint")}
        </p>
      )}
    </div>
  );
}
