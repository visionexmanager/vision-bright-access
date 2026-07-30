import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProjectById, useCreateProject, useSaveProject, useSetProjectPublic } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { CanvasDrawingEngine, type CanvasDrawingEngineHandle } from "@/features/visionkids/components/studio/CanvasDrawingEngine";
import { ParentalGate } from "@/features/visionkids/components/studio/ParentalGate";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";

export default function StickerMaker() {
  const { projectId } = useParams<{ projectId: string }>();
  const isNew = !projectId || projectId === "new";
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: project } = useProjectById(isNew ? undefined : projectId);
  const createProject = useCreateProject();
  const saveProject = useSaveProject();
  const setPublic = useSetProjectPublic();

  const engineRef = useRef<CanvasDrawingEngineHandle>(null);
  const [title, setTitle] = useState(t("kids.studio.mySticker"));
  const [savedId, setSavedId] = useState<string | undefined>(isNew ? undefined : projectId);
  const [strokeCount, setStrokeCount] = useState(0);

  useDocumentHead({ title: t("kids.studio.stickerMakerTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/sticker-maker" });

  useEffect(() => { if (project) setTitle(project.title); }, [project]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  // Adds the "die-cut sticker" white border/shadow around the artwork.
  const stickerize = (rawDataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const pad = 16;
        canvas.width = img.width + pad * 2;
        canvas.height = img.height + pad * 2;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, 24);
        ctx.fill();
        ctx.drawImage(img, pad, pad);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = rawDataUrl;
    });

  const handleSave = async () => {
    const raw = engineRef.current?.toDataUrl() ?? "";
    const thumbnailUrl = await stickerize(raw);
    if (!savedId) {
      const created = await createProject.mutateAsync({ projectType: "sticker", title, thumbnailUrl, content: { strokeCount } });
      setSavedId(created.id);
      navigate(`/kids/studio/sticker-maker/${created.id}`, { replace: true });
    } else {
      await saveProject.mutateAsync({ id: savedId, title, thumbnailUrl, content: { strokeCount } });
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />
        {(saveProject.isPending || createProject.isPending) && <AutoSaveIndicator saving />}
      </div>

      <div className="mt-4">
        <CanvasDrawingEngine ref={engineRef} width={320} height={320} onChange={setStrokeCount} />
      </div>

      <Button onClick={handleSave} disabled={strokeCount === 0} className="mt-4 gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
        <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.saveSticker")}
      </Button>

      {project && (
        <div className="mt-4">
          <ParentalGate project={project} onToggle={(next) => setPublic.mutate({ id: project.id, isPublic: next })} />
        </div>
      )}
    </div>
  );
}
