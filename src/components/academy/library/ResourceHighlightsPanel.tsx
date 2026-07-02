import { useState, type FormEvent } from "react";
import { Highlighter, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AcademyResourceHighlightRow } from "@/lib/types/academy-library";

interface ResourceHighlightsPanelProps {
  highlights: AcademyResourceHighlightRow[];
  onAddHighlight: (quotedText: string) => void;
  onRemoveHighlight: (highlightId: string) => void;
}

/**
 * Since resource content is rendered inside an iframe (PDF/document/
 * presentation viewers can't be scripted into for real text selection),
 * highlights are captured by pasting the quoted passage rather than an
 * in-viewer text-selection gesture.
 */
export function ResourceHighlightsPanel({ highlights, onAddHighlight, onRemoveHighlight }: ResourceHighlightsPanelProps) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddHighlight(draft.trim());
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="resource-highlight-input" className="sr-only">أضف اقتباساً مميزاً</label>
        <Input id="resource-highlight-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="الصق الجزء الذي تريد تمييزه..." className="rounded-xl" />
        <Button type="submit" size="sm" disabled={!draft.trim()} className="rounded-xl shrink-0">تمييز</Button>
      </form>

      {highlights.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد أجزاء مميّزة بعد.</p>
      ) : (
        <ul className="space-y-2">
          {highlights.map((h) => (
            <li key={h.id} className="flex items-start gap-2 p-3 rounded-xl border-s-4 bg-yellow-400/10" style={{ borderInlineStartColor: h.color }}>
              <Highlighter className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="flex-1 text-sm text-foreground italic">"{h.quoted_text}"</p>
              <button onClick={() => onRemoveHighlight(h.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="حذف التمييز">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
