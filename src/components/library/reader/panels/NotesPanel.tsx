import { FormEvent, useRef, useState } from "react";
import { Pencil, Search, StickyNote, Trash2, Pin, PinOff, Mic, Square, Image as ImageIcon, X, Download, Notebook as NotebookIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNotes } from "@/hooks/library/useNotes";
import { useNotebooks } from "@/hooks/library/useNotebooks";
import { uploadNoteMedia, exportNotesAsMarkdown } from "@/services/library/notes";
import { toast } from "@/hooks/use-toast";

interface NotesPanelProps {
  bookId: string;
  bookTitle?: string;
  currentPage: number | null;
}

export function NotesPanel({ bookId, bookTitle, currentPage }: NotesPanelProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { notes, isLoading, addNote, editNote, removeNote, togglePin, setTags, moveToNotebook, search } = useNotes(bookId);
  const { notebooks } = useNotebooks();
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    void addNote(currentPage, newContent);
    setNewContent("");
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    void search(value);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (!user) return;
        setIsUploading(true);
        try {
          const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
          const url = await uploadNoteMedia(user.id, file);
          await addNote(currentPage, t("library.notes.voiceNote"), { noteType: "voice", voiceUrl: url });
        } catch (err) {
          toast({ title: "Couldn't save voice note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleImageSelected = async (file: File | undefined) => {
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const url = await uploadNoteMedia(user.id, file);
      await addNote(currentPage, t("library.notes.imageNote"), { noteType: "image", imageUrl: url });
    } catch (err) {
      toast({ title: "Couldn't save image note", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    const markdown = exportNotesAsMarkdown(bookTitle ?? "Book", notes);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notes-${bookId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder={t("library.reader.searchNotes")} className="ps-8" />
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={3} placeholder={t("library.reader.newNotePlaceholder")} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={!newContent.trim()}>{t("library.reader.addNote")}</Button>
          {isRecording ? (
            <Button type="button" size="sm" variant="destructive" className="gap-1.5" onClick={stopVoiceRecording}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.notes.stopRecording")}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={isUploading} onClick={() => void startVoiceRecording()}>
              <Mic className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.notes.recordVoice")}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={isUploading} onClick={() => imageInputRef.current?.click()}>
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.notes.attachImage")}
          </Button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleImageSelected(e.target.files?.[0])} />
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={handleExport} disabled={notes.length === 0}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.notes.export")}
          </Button>
        </div>
      </form>

      {isLoading ? (
        <SkeletonLoader variant="list" count={3} />
      ) : notes.length === 0 ? (
        <EmptyState icon={<StickyNote className="h-8 w-8" />} title={t("library.reader.noNotes")} className="py-8" />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3">
              {editingId === note.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => { e.preventDefault(); void editNote(note.id, editValue); setEditingId(null); }}
                >
                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} autoFocus />
                  <Button type="submit" size="sm">{t("library.reviews.update")}</Button>
                </form>
              ) : (
                <>
                  {note.note_type === "image" && note.image_url && (
                    <img src={note.image_url} alt="" className="mb-2 max-h-48 w-full rounded-md object-cover" />
                  )}
                  {note.note_type === "voice" && note.voice_url && (
                    <audio controls src={note.voice_url} className="mb-2 w-full" />
                  )}
                  <p className="whitespace-pre-line text-sm">{note.content}</p>

                  {note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                          {tag}
                          <button type="button" onClick={() => void setTags(note.id, note.tags.filter((tg) => tg !== tag))} aria-label={`Remove tag ${tag}`}>
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Input
                    value={tagDraft[note.id] ?? ""}
                    onChange={(e) => setTagDraft((prev) => ({ ...prev, [note.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && tagDraft[note.id]?.trim()) {
                        e.preventDefault();
                        void setTags(note.id, [...note.tags, tagDraft[note.id].trim()]);
                        setTagDraft((prev) => ({ ...prev, [note.id]: "" }));
                      }
                    }}
                    placeholder={t("library.notes.addTag")}
                    className="mt-2 h-7 text-xs"
                  />

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {note.page_number != null ? `${t("library.bookDetails.pages")} ${note.page_number} · ` : ""}
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1">
                      {notebooks.length > 0 && (
                        <Select value={note.notebook_id ?? "none"} onValueChange={(v) => void moveToNotebook(note.id, v === "none" ? null : v)}>
                          <SelectTrigger className="h-7 w-28 gap-1 text-xs" aria-label={t("library.notes.moveToNotebookLabel")}><NotebookIcon className="h-3 w-3" aria-hidden="true" /><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t("library.notes.noNotebook")}</SelectItem>
                            {notebooks.map((nb) => <SelectItem key={nb.id} value={nb.id}>{nb.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => void togglePin(note.id, !note.is_pinned)}
                        aria-label={note.is_pinned ? t("library.notes.unpin") : t("library.notes.pin")}
                      >
                        {note.is_pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(note.id); setEditValue(note.content); }} aria-label={t("library.reviews.edit")}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => void removeNote(note.id)} aria-label={t("library.reviews.delete")}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
