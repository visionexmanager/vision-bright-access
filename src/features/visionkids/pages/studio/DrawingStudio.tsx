import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Save, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProjectById, useCreateProject, useSaveProject, useSetProjectPublic } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { useDrawingToArt } from "@/features/visionkids/hooks/studio/useDrawingToArt";
import { CanvasDrawingEngine, type CanvasDrawingEngineHandle } from "@/features/visionkids/components/studio/CanvasDrawingEngine";
import { ParentalGate } from "@/features/visionkids/components/studio/ParentalGate";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";

export default function DrawingStudio() {
  const { projectId } = useParams<{ projectId: string }>();
  const isNew = !projectId || projectId === "new";
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: project } = useProjectById(isNew ? undefined : projectId);
  const createProject = useCreateProject();
  const saveProject = useSaveProject();
  const setPublic = useSetProjectPublic();
  const drawingToArt = useDrawingToArt();

  const engineRef = useRef<CanvasDrawingEngineHandle>(null);
  const [title, setTitle] = useState(t("kids.studio.myDrawing"));
  const [savedId, setSavedId] = useState<string | undefined>(isNew ? undefined : projectId);
  const [strokeCount, setStrokeCount] = useState(0);
  const [aiResult, setAiResult] = useState<{ description: string; imageUrl: string } | null>(null);

  useDocumentHead({ title: t("kids.studio.drawingStudioTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/drawing-studio" });

  useEffect(() => { if (project) setTitle(project.title); }, [project]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const handleSave = async () => {
    const thumbnailUrl = engineRef.current?.toDataUrl() ?? "";
    if (!savedId) {
      const created = await createProject.mutateAsync({ projectType: "drawing", title, thumbnailUrl, content: { strokeCount } });
      setSavedId(created.id);
      navigate(`/kids/studio/drawing-studio/${created.id}`, { replace: true });
    } else {
      await saveProject.mutateAsync({ id: savedId, title, thumbnailUrl, content: { strokeCount } });
    }
  };

  const handleAiify = async () => {
    const dataUrl = engineRef.current?.toDataUrl();
    if (!dataUrl) return;
    const result = await drawingToArt.mutateAsync(dataUrl);
    setAiResult(result);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />
        {(saveProject.isPending || createProject.isPending) ? <AutoSaveIndicator saving /> : savedId && <AutoSaveIndicator saving={false} />}
      </div>

      <div className="mt-4">
        <CanvasDrawingEngine ref={engineRef} onChange={setStrokeCount} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={strokeCount === 0} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
          <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.save")}
        </Button>
        <Button variant="outline" onClick={handleAiify} disabled={!savedId || strokeCount === 0 || drawingToArt.isPending} className="gap-1.5">
          {drawingToArt.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />} {t("kids.studio.aiify")}
        </Button>
      </div>

      {drawingToArt.isError && <p className="mt-2 text-sm text-destructive" role="alert">{t("kids.studio.aiifyError")}</p>}

      {aiResult && (
        <div className="mt-4 rounded-2xl border-2 border-kids-purple/40 bg-kids-purple/10 p-4">
          <p className="text-sm text-muted-foreground">{aiResult.description}</p>
          <img src={aiResult.imageUrl} alt={t("kids.studio.aiVersionAlt")} className="mt-2 w-full rounded-xl" />
        </div>
      )}

      {project && (
        <div className="mt-4">
          <ParentalGate project={project} onToggle={(next) => setPublic.mutate({ id: project.id, isPublic: next })} />
        </div>
      )}
    </div>
  );
}
