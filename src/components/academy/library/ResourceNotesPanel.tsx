import { useState, type FormEvent } from "react";
import { Trash2, StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { AcademyResourceNoteRow } from "@/lib/types/academy-library";

interface ResourceNotesPanelProps {
  notes: AcademyResourceNoteRow[];
  onAddNote: (content: string) => void;
  onRemoveNote: (noteId: string) => void;
}

export function ResourceNotesPanel({ notes, onAddNote, onRemoveNote }: ResourceNotesPanelProps) {
  const [draft, setDraft] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddNote(draft.trim());
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="resource-note-input" className="sr-only">أضف ملاحظة</label>
        <Textarea id="resource-note-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="اكتب ملاحظتك على هذا المورد..." className="rounded-xl min-h-20" />
        <Button type="submit" size="sm" disabled={!draft.trim()} className="rounded-xl">حفظ الملاحظة</Button>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد ملاحظات على هذا المورد بعد.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <StickyNote className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="flex-1 text-sm text-foreground">{note.content}</p>
              <button onClick={() => onRemoveNote(note.id)} className="text-muted-foreground hover:text-destructive shrink-0" aria-label="حذف الملاحظة">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
