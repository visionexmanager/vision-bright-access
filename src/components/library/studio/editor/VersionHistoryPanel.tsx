import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVersionHistory } from "@/hooks/library/useVersionHistory";

interface VersionHistoryPanelProps {
  chapterId: string;
}

export function VersionHistoryPanel({ chapterId }: VersionHistoryPanelProps) {
  const { t } = useLanguage();
  const { savedVersions, autosaveVersions, isLoading, restore } = useVersionHistory(chapterId);
  const [showAutosaves, setShowAutosaves] = useState(false);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />;
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="h-4 w-4" aria-hidden="true" />
        {t("library.studio.editor.versionHistory")}
      </h3>

      {savedVersions.length === 0 && autosaveVersions.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("library.studio.editor.noVersionsYet")}</p>
      ) : (
        <ul className="space-y-1.5">
          {savedVersions.map((version) => (
            <li key={version.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <span>{version.version_note || formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void restore(version)} aria-label={t("library.studio.editor.restoreVersion")}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {autosaveVersions.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-1 text-xs" onClick={() => setShowAutosaves((v) => !v)}>
            {showAutosaves ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
            {t("library.studio.editor.showAutosaves").replace("{count}", String(autosaveVersions.length))}
          </Button>
          {showAutosaves && (
            <ul className="mt-1.5 space-y-1.5">
              {autosaveVersions.map((version) => (
                <li key={version.id} className="flex items-center justify-between rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                  <span>{formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void restore(version)} aria-label={t("library.studio.editor.restoreVersion")}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
