import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Play, Download, Save, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreateProject, useUploadStudioAsset, useSaveProject } from "@/features/visionkids/hooks/studio/useStudioProjects";
import type { VideoSlide } from "@/features/visionkids/types/studio.types";

export default function VideoCreator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const createProject = useCreateProject();
  const uploadAsset = useUploadStudioAsset();
  const saveProject = useSaveProject();

  const [title, setTitle] = useState(t("kids.studio.myVideo"));
  const [slides, setSlides] = useState<VideoSlide[]>([]);
  const [playing, setPlaying] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useDocumentHead({ title: t("kids.studio.videoCreatorTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/video-creator" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const addSlideFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setSlides((prev) => [...prev, { imageUrl: reader.result as string, caption: "", durationMs: 2500 }]);
    reader.readAsDataURL(file);
  };

  const updateSlide = (i: number, patch: Partial<VideoSlide>) => setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeSlide = (i: number) => setSlides((prev) => prev.filter((_, idx) => idx !== i));

  const drawSlide = (slide: VideoSlide) =>
    new Promise<void>((resolve) => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        if (slide.caption) {
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
          ctx.fillStyle = "#fff";
          ctx.font = "20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(slide.caption, canvas.width / 2, canvas.height - 18);
        }
        resolve();
      };
      img.src = slide.imageUrl;
    });

  const playPreview = async () => {
    setPlaying(true);
    for (let i = 0; i < slides.length; i++) {
      setActiveSlide(i);
      await drawSlide(slides[i]);
      await new Promise((r) => setTimeout(r, slides[i].durationMs));
    }
    setPlaying(false);
  };

  /** Real video export — captures the canvas as it plays through every
   *  slide via canvas.captureStream() + MediaRecorder, producing an
   *  actual downloadable/saveable .webm file, not just an in-app preview. */
  const exportVideo = async () => {
    if (slides.length === 0) return;
    setExporting(true);
    try {
      const canvas = canvasRef.current!;
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      });
      recorder.start();
      for (const slide of slides) {
        await drawSlide(slide);
        await new Promise((r) => setTimeout(r, slide.durationMs));
      }
      recorder.stop();
      const blob = await done;

      const created = await createProject.mutateAsync({ projectType: "video", title, content: { slides } });
      const url = await uploadAsset.mutateAsync({ file: blob, projectId: created.id, filename: "video.webm" });
      await saveProject.mutateAsync({ id: created.id, saveVersion: false, assetUrls: [url] });
      setSavedProjectId(created.id);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />

      <canvas ref={canvasRef} width={480} height={320} className="mt-4 w-full rounded-xl border-2 border-border bg-black" aria-label={t("kids.studio.videoPreview")} />

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border-2 border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
          <Upload className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.addImage")}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && addSlideFromFile(e.target.files[0])} />
        </label>
        <Button variant="outline" onClick={playPreview} disabled={slides.length === 0 || playing} className="gap-1.5">
          <Play className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.preview")}
        </Button>
        <Button onClick={exportVideo} disabled={slides.length === 0 || exporting} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} {t("kids.studio.exportVideo")}
        </Button>
      </div>

      {savedProjectId && <p className="mt-2 text-sm font-semibold text-kids-green">{t("kids.studio.videoSaved")}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {slides.map((slide, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-xl border-2 p-2 ${playing && activeSlide === i ? "border-kids-primary" : "border-border"}`}>
            <img src={slide.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
            <Input value={slide.caption} onChange={(e) => updateSlide(i, { caption: e.target.value })} placeholder={t("kids.studio.captionPlaceholder")} className="flex-1" maxLength={60} />
            <Button variant="ghost" size="icon" onClick={() => removeSlide(i)} aria-label={t("kids.academy.skip")}><Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" /></Button>
          </div>
        ))}
      </div>
      {slides.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t("kids.studio.addImagesHint")}</p>}
    </div>
  );
}
