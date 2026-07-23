import { useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBookEditions } from "@/hooks/library/useBookEditions";
import { useLanguage } from "@/contexts/LanguageContext";

interface EditionHistoryPanelProps {
  bookId: string;
}

/** Book-level digital preservation — distinct from the chapter-draft
 *  VersionHistoryPanel inside the editor. Archiving a new edition here
 *  retires the previous one via create_library_book_edition(), a single
 *  atomic RPC. */
export function EditionHistoryPanel({ bookId }: EditionHistoryPanelProps) {
  const { t } = useLanguage();
  const { editions, createEdition, isCreating } = useBookEditions(bookId);
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState("");

  return (
    <Card className="mt-4 space-y-3 p-5">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Archive className="h-4 w-4" aria-hidden="true" /> {t("library.studio.editions.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("library.studio.editions.description")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <Label htmlFor="edition-label">{t("library.studio.editions.labelPlaceholder")}</Label>
          <Input id="edition-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2nd Edition" />
        </div>
        <div className="flex-[2] min-w-[200px]">
          <Label htmlFor="edition-summary">{t("library.studio.editions.summaryPlaceholder")}</Label>
          <Textarea id="edition-summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={1} className="min-h-0" />
        </div>
        <Button
          onClick={async () => { await createEdition(label, summary); setLabel(""); setSummary(""); }}
          disabled={isCreating || !label.trim()}
          className="gap-1.5"
        >
          {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
          {t("library.studio.editions.archiveCurrent")}
        </Button>
      </div>

      {editions.length > 0 && (
        <ul className="space-y-2">
          {editions.map((edition) => (
            <li key={edition.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div>
                <span className="font-medium">{edition.edition_label}</span>
                {edition.change_summary && <span className="ms-2 text-muted-foreground">{edition.change_summary}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {edition.is_current && <Badge variant="secondary">{t("library.studio.editions.current")}</Badge>}
                <span>{new Date(edition.created_at).toLocaleDateString()}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
