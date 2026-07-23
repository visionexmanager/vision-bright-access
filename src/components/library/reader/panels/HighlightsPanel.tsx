import { useState } from "react";
import { Download, Highlighter, Trash2, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShareButton } from "@/components/library/ShareButton";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHighlights } from "@/hooks/library/useHighlights";
import { cn } from "@/lib/utils";

interface HighlightsPanelProps {
  bookId: string;
  bookTitle: string;
}

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400", green: "bg-green-400", blue: "bg-blue-400", pink: "bg-pink-400", purple: "bg-purple-400",
};

export function HighlightsPanel({ bookId, bookTitle }: HighlightsPanelProps) {
  const { t } = useLanguage();
  const { highlights, isLoading, removeHighlight, toggleFavorite, setNote, search, exportAsMarkdown } = useHighlights(bookId, bookTitle);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    void search(value);
  };

  const handleExport = () => {
    const markdown = exportAsMarkdown();
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bookTitle.replace(/[^\w\- ]/g, "")}-highlights.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <SkeletonLoader variant="list" count={3} />;

  const visible = filter === "favorites" ? highlights.filter((h) => h.is_favorite) : highlights;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder={t("library.highlights.searchPlaceholder")} className="ps-8" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "favorites")}>
          <TabsList>
            <TabsTrigger value="all">{t("library.highlights.all")}</TabsTrigger>
            <TabsTrigger value="favorites">{t("library.highlights.favoritesOnly")}</TabsTrigger>
          </TabsList>
        </Tabs>
        {highlights.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shrink-0">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.reader.exportHighlights")}
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Highlighter className="h-8 w-8" />} title={t("library.reader.noHighlights")} className="py-8" />
      ) : (
        <ul className="space-y-2">
          {visible.map((h) => (
            <li key={h.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", COLOR_DOT[h.color])} aria-hidden="true" />
                <p className="flex-1 text-sm italic">&ldquo;{h.quoted_text}&rdquo;</p>
              </div>
              {h.note && <p className="mt-1.5 ms-4 text-xs text-muted-foreground">{h.note}</p>}
              <Input
                value={noteDraft[h.id] ?? h.note ?? ""}
                onChange={(e) => setNoteDraft((prev) => ({ ...prev, [h.id]: e.target.value }))}
                onBlur={(e) => { if (e.target.value !== (h.note ?? "")) void setNote(h.id, e.target.value.trim() || null); }}
                placeholder={t("library.highlights.addNote")}
                className="mt-2 h-7 text-xs"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{h.page_number != null ? `${t("library.bookDetails.pages")} ${h.page_number}` : ""}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => void toggleFavorite(h.id, !h.is_favorite)}
                    aria-label={h.is_favorite ? t("library.highlights.unfavorite") : t("library.highlights.favorite")}
                  >
                    <Star className={cn("h-3.5 w-3.5", h.is_favorite && "fill-primary text-primary")} aria-hidden="true" />
                  </Button>
                  <ShareButton title={bookTitle} text={h.quoted_text} className="h-7 w-7" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void removeHighlight(h.id)} aria-label={t("library.reviews.delete")}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
