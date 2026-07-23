import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookMultiPicker } from "@/components/library/research/BookMultiPicker";
import { fetchSavedSearches } from "@/services/library/aiSearch";
import { fetchResearchAnalyses } from "@/services/library/researchAssistant";
import { fetchAllUserNotes, fetchAllUserHighlights, type LibraryBookSearchHit, type LibraryOwnNoteHit, type LibraryOwnHighlightHit } from "@/services/library/researchWorkspace";
import type { LibrarySavedSearchRow } from "@/services/library/aiSearch";
import type { LibraryResearchAnalysisRow } from "@/services/library/researchAssistant";
import type { AddProjectItemInput, LibraryResearchItemType } from "@/services/library/researchProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface AddProjectItemDialogProps {
  onAdd: (input: AddProjectItemInput) => void | Promise<void>;
}

const TYPES: LibraryResearchItemType[] = ["book", "note", "highlight", "reference", "saved_search", "analysis"];

export function AddProjectItemDialog({ onAdd }: AddProjectItemDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [itemType, setItemType] = useState<LibraryResearchItemType>("book");
  const [books, setBooks] = useState<LibraryBookSearchHit[]>([]);
  const [notes, setNotes] = useState<LibraryOwnNoteHit[]>([]);
  const [highlights, setHighlights] = useState<LibraryOwnHighlightHit[]>([]);
  const [savedSearches, setSavedSearches] = useState<LibrarySavedSearchRow[]>([]);
  const [analyses, setAnalyses] = useState<LibraryResearchAnalysisRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [citationText, setCitationText] = useState("");

  useEffect(() => {
    if (!isOpen || !user) return;
    if (itemType === "note" && notes.length === 0) void fetchAllUserNotes(user.id).then(setNotes);
    if (itemType === "highlight" && highlights.length === 0) void fetchAllUserHighlights(user.id).then(setHighlights);
    if (itemType === "saved_search" && savedSearches.length === 0) void fetchSavedSearches(user.id).then(setSavedSearches);
    if (itemType === "analysis" && analyses.length === 0) void fetchResearchAnalyses(user.id).then(setAnalyses);
  }, [isOpen, itemType, user, notes.length, highlights.length, savedSearches.length, analyses.length]);

  const reset = () => {
    setBooks([]);
    setSelectedId("");
    setCitationText("");
  };

  const handleAdd = async () => {
    if (itemType === "book") {
      for (const book of books) await onAdd({ itemType: "book", bookId: book.id });
    } else if (itemType === "reference") {
      if (!citationText.trim()) return;
      await onAdd({ itemType: "reference", citationText: citationText.trim() });
    } else if (selectedId) {
      const key = itemType === "note" ? "noteId" : itemType === "highlight" ? "highlightId" : itemType === "saved_search" ? "savedSearchId" : "analysisId";
      await onAdd({ itemType, [key]: selectedId } as AddProjectItemInput);
    }
    reset();
    setIsOpen(false);
  };

  const canAdd = itemType === "book" ? books.length > 0 : itemType === "reference" ? citationText.trim().length > 0 : !!selectedId;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.researchProjects.addItem")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("library.researchProjects.addItem")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={itemType} onValueChange={(v) => { setItemType(v as LibraryResearchItemType); reset(); }}>
            <SelectTrigger aria-label={t("library.researchProjects.addItem")}><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map((tItem) => <SelectItem key={tItem} value={tItem}>{t(`library.researchProjects.itemType.${tItem}`)}</SelectItem>)}
            </SelectContent>
          </Select>

          {itemType === "book" && <BookMultiPicker selected={books} onChange={setBooks} />}

          {itemType === "reference" && (
            <Textarea value={citationText} onChange={(e) => setCitationText(e.target.value)} rows={3} placeholder={t("library.researchProjects.citationPlaceholder")} />
          )}

          {itemType === "note" && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger aria-label={t("library.researchProjects.pickNote")}><SelectValue placeholder={t("library.researchProjects.pickNote")} /></SelectTrigger>
              <SelectContent>{notes.map((n) => <SelectItem key={n.id} value={n.id}>{n.content.slice(0, 60)}</SelectItem>)}</SelectContent>
            </Select>
          )}

          {itemType === "highlight" && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger aria-label={t("library.researchProjects.pickHighlight")}><SelectValue placeholder={t("library.researchProjects.pickHighlight")} /></SelectTrigger>
              <SelectContent>{highlights.map((h) => <SelectItem key={h.id} value={h.id}>{h.quoted_text.slice(0, 60)}</SelectItem>)}</SelectContent>
            </Select>
          )}

          {itemType === "saved_search" && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger aria-label={t("library.researchProjects.pickSavedSearch")}><SelectValue placeholder={t("library.researchProjects.pickSavedSearch")} /></SelectTrigger>
              <SelectContent>{savedSearches.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}

          {itemType === "analysis" && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger aria-label={t("library.researchProjects.pickAnalysis")}><SelectValue placeholder={t("library.researchProjects.pickAnalysis")} /></SelectTrigger>
              <SelectContent>{analyses.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => void handleAdd()} disabled={!canAdd}>{t("library.researchProjects.addItem")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
