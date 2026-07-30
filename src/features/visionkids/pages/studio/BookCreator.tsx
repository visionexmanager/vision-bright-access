import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { jsPDF } from "jspdf";
import { ChevronLeft, Save, Plus, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProjectById, useCreateProject, useSaveProject } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { useMyAiStories } from "@/features/visionkids/hooks/stories/useAiStoryGenerator";
import type { BookContent } from "@/features/visionkids/types/studio.types";

const COVER_COLORS = ["#4F46E5", "#EC4899", "#22C55E", "#F59E0B", "#8B5CF6"];
const COVER_EMOJIS = ["📖", "🚀", "🦄", "🐶", "🌟", "🏰"];

export default function BookCreator() {
  const { projectId } = useParams<{ projectId: string }>();
  const isNew = !projectId || projectId === "new";
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: project } = useProjectById(isNew ? undefined : projectId);
  const { data: aiStories = [] } = useMyAiStories();
  const createProject = useCreateProject();
  const saveProject = useSaveProject();

  const [savedId, setSavedId] = useState<string | undefined>(isNew ? undefined : projectId);
  const [book, setBook] = useState<BookContent>(
    (project?.content as BookContent | undefined) ?? { coverTitle: t("kids.studio.myBook"), coverAuthor: "", coverColor: COVER_COLORS[0], coverEmoji: COVER_EMOJIS[0], pages: [{ text: "" }] }
  );

  useDocumentHead({ title: t("kids.studio.bookCreatorTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/book-creator" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const importAiStory = (id: string) => {
    const story = aiStories.find((s) => s.id === id);
    if (!story) return;
    setBook((prev) => ({ ...prev, coverTitle: story.title, pages: story.pages.map((p) => ({ text: p.text, imageUrl: p.imageUrl })) }));
  };

  const addPage = () => setBook((prev) => ({ ...prev, pages: [...prev.pages, { text: "" }] }));
  const updatePage = (i: number, text: string) => setBook((prev) => ({ ...prev, pages: prev.pages.map((p, idx) => (idx === i ? { ...p, text } : p)) }));
  const removePage = (i: number) => setBook((prev) => ({ ...prev, pages: prev.pages.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!savedId) {
      const created = await createProject.mutateAsync({ projectType: "book", title: book.coverTitle, content: book });
      setSavedId(created.id);
    } else {
      await saveProject.mutateAsync({ id: savedId, title: book.coverTitle, content: book });
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();

    doc.setFillColor(book.coverColor);
    doc.rect(0, 0, w, h, "F");
    doc.setFontSize(48);
    doc.text(book.coverEmoji, w / 2, h / 2 - 40, { align: "center" });
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(book.coverTitle, w / 2, h / 2 + 20, { align: "center", maxWidth: w - 80 });
    if (book.coverAuthor) {
      doc.setFontSize(14);
      doc.text(book.coverAuthor, w / 2, h / 2 + 60, { align: "center" });
    }

    doc.addPage();
    doc.setTextColor("#000000");
    doc.setFontSize(18);
    doc.text(t("kids.studio.tableOfContents"), 40, 50);
    doc.setFontSize(12);
    book.pages.forEach((_, i) => doc.text(`${i + 1}`, 40, 80 + i * 20));

    book.pages.forEach((page, i) => {
      doc.addPage();
      doc.setFontSize(12);
      doc.text(`${i + 1}`, w - 30, h - 20);
      doc.setFontSize(16);
      doc.text(page.text || "", 40, 60, { maxWidth: w - 80 });
    });

    doc.save(`${book.coverTitle || "book"}.pdf`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      {aiStories.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-dashed border-border p-3">
          <p className="mb-2 text-sm font-semibold">{t("kids.studio.importFromAiStory")}</p>
          <div className="flex flex-wrap gap-2">
            {aiStories.slice(0, 5).map((s) => (
              <button key={s.id} type="button" onClick={() => importAiStory(s.id)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">{s.title}</button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-6 text-center text-white" style={{ backgroundColor: book.coverColor }}>
        <p className="text-5xl">{book.coverEmoji}</p>
        <Input value={book.coverTitle} onChange={(e) => setBook((p) => ({ ...p, coverTitle: e.target.value }))} className="mt-3 border-white/40 bg-white/10 text-center font-heading text-xl font-bold text-white placeholder:text-white/60" />
        <Input value={book.coverAuthor} onChange={(e) => setBook((p) => ({ ...p, coverAuthor: e.target.value }))} placeholder={t("kids.studio.authorName")} className="mt-2 border-white/40 bg-white/10 text-center text-sm text-white placeholder:text-white/60" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <div role="group" aria-label={t("kids.studio.coverColor")} className="flex gap-1">
          {COVER_COLORS.map((c) => <button key={c} type="button" onClick={() => setBook((p) => ({ ...p, coverColor: c }))} className="h-7 w-7 rounded-full border-2 border-border" style={{ backgroundColor: c }} aria-label={c} />)}
        </div>
        <div role="group" aria-label={t("kids.studio.coverEmoji")} className="flex gap-1">
          {COVER_EMOJIS.map((e) => <button key={e} type="button" onClick={() => setBook((p) => ({ ...p, coverEmoji: e }))} className="text-lg">{e}</button>)}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <p className="font-heading text-lg font-bold">{t("kids.studio.pages")}</p>
        {book.pages.map((page, i) => (
          <div key={i} className="flex gap-2 rounded-xl border-2 border-border p-3">
            <span className="pt-2 text-sm text-muted-foreground">{i + 1}</span>
            <Textarea value={page.text} onChange={(e) => updatePage(i, e.target.value)} placeholder={t("kids.studio.pageTextPlaceholder")} className="flex-1" />
            {page.imageUrl && <img src={page.imageUrl} alt="" className="h-16 w-16 rounded object-cover" />}
            <Button variant="ghost" size="icon" onClick={() => removePage(i)} aria-label={t("kids.academy.skip")}><Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" /></Button>
          </div>
        ))}
        <Button variant="outline" onClick={addPage} className="gap-1.5 self-start"><Plus className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.addPage")}</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={handleSave} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90"><Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.saveBook")}</Button>
        <Button variant="outline" onClick={exportPdf} className="gap-1.5"><Download className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.exportPdf")}</Button>
      </div>
    </div>
  );
}
