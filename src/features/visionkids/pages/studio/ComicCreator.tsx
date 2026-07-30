import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Save, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreateProject } from "@/features/visionkids/hooks/studio/useStudioProjects";
import type { ComicPanel } from "@/features/visionkids/types/studio.types";

const PANEL_COLORS = ["#fef3c7", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", "#fee2e2"];
const CHARACTER_EMOJIS = ["🦸", "🐶", "🐱", "🤖", "🦄", "👧", "👦", "🐉"];
const PANEL_COUNTS = [2, 4, 6] as const;

function emptyPanel(i: number): ComicPanel {
  return { background: PANEL_COLORS[i % PANEL_COLORS.length], characterEmoji: CHARACTER_EMOJIS[0], captionTop: "", speechBubble: "" };
}

export default function ComicCreator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const createProject = useCreateProject();

  const [title, setTitle] = useState(t("kids.studio.myComic"));
  const [panelCount, setPanelCount] = useState<typeof PANEL_COUNTS[number]>(4);
  const [panels, setPanels] = useState<ComicPanel[]>(Array.from({ length: 4 }, (_, i) => emptyPanel(i)));
  const [saved, setSaved] = useState(false);

  useDocumentHead({ title: t("kids.studio.comicCreatorTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/comic-creator" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const changeCount = (count: typeof PANEL_COUNTS[number]) => {
    setPanelCount(count);
    setPanels((prev) => {
      if (count > prev.length) return [...prev, ...Array.from({ length: count - prev.length }, (_, i) => emptyPanel(prev.length + i))];
      return prev.slice(0, count);
    });
  };

  const updatePanel = (i: number, patch: Partial<ComicPanel>) => setPanels((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const renderToCanvas = (): string => {
    const cols = panelCount <= 2 ? 2 : panelCount === 4 ? 2 : 3;
    const rows = Math.ceil(panelCount / cols);
    const panelSize = 200;
    const canvas = document.createElement("canvas");
    canvas.width = cols * panelSize;
    canvas.height = rows * panelSize;
    const ctx = canvas.getContext("2d")!;
    panels.forEach((panel, i) => {
      const x = (i % cols) * panelSize;
      const y = Math.floor(i / cols) * panelSize;
      ctx.fillStyle = panel.background;
      ctx.fillRect(x, y, panelSize, panelSize);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, panelSize - 4, panelSize - 4);
      ctx.font = "64px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(panel.characterEmoji, x + panelSize / 2, y + panelSize / 2 + 20);
      if (panel.speechBubble) {
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText(panel.speechBubble.slice(0, 24), x + panelSize / 2, y + panelSize - 16);
      }
    });
    return canvas.toDataURL("image/png");
  };

  const handleSave = async () => {
    const thumbnailUrl = renderToCanvas();
    await createProject.mutateAsync({ projectType: "comic", title, thumbnailUrl, content: { panels } });
    setSaved(true);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = `${title || "comic"}.png`;
    link.href = renderToCanvas();
    link.click();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />

      <div className="mt-4" role="group" aria-label={t("kids.studio.panelCount")}>
        {PANEL_COUNTS.map((c) => (
          <button key={c} type="button" onClick={() => changeCount(c)} aria-pressed={panelCount === c} className={`me-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${panelCount === c ? "border-kids-primary bg-kids-primary/10 text-kids-primary" : "border-border"}`}>
            {c} {t("kids.studio.panels")}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {panels.map((panel, i) => (
          <div key={i} className="rounded-xl border-2 border-border p-3" style={{ backgroundColor: panel.background }}>
            <div className="flex items-center justify-between">
              <span className="text-4xl">{panel.characterEmoji}</span>
              <div className="flex gap-1">
                {PANEL_COLORS.map((c) => <button key={c} type="button" onClick={() => updatePanel(i, { background: c })} className="h-5 w-5 rounded-full border border-black/20" style={{ backgroundColor: c }} aria-label={c} />)}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {CHARACTER_EMOJIS.map((e) => <button key={e} type="button" onClick={() => updatePanel(i, { characterEmoji: e })} className="text-lg">{e}</button>)}
            </div>
            <Input value={panel.speechBubble} onChange={(e) => updatePanel(i, { speechBubble: e.target.value })} placeholder={t("kids.studio.speechBubblePlaceholder")} className="mt-2 bg-white/80" maxLength={30} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saved} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
          <Save className="h-4 w-4" aria-hidden="true" /> {saved ? t("kids.studio.saved") : t("kids.studio.saveComic")}
        </Button>
        <Button variant="outline" onClick={handleDownload} className="gap-1.5">
          <Download className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.downloadPng")}
        </Button>
      </div>
    </div>
  );
}
