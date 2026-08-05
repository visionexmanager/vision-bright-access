import { jsonAs } from "@/integrations/supabase/json";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useProjectById, useCreateProject, useSaveProject, useSetProjectPublic } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { ParentalGate } from "@/features/visionkids/components/studio/ParentalGate";
import { AutoSaveIndicator } from "@/features/visionkids/components/studio/AutoSaveIndicator";
import type { CharacterContent } from "@/features/visionkids/types/studio.types";

const BODY_COLORS = ["#fbbf9d", "#f0b088", "#c68863", "#8d5524", "#5c3a21"];
const HAIR_OPTIONS = ["👦", "👧", "🧑‍🦱", "🧑‍🦰", "🧑‍🦳", "🧑‍🦲"];
const FACE_OPTIONS = ["😀", "😊", "😎", "🤓", "😄", "🥳"];
const OUTFIT_OPTIONS = ["👕", "🥋", "👗", "🦺", "🧥", "👘"];
const ACCESSORY_OPTIONS = ["🎩", "👑", "🎀", "🕶️", "🧢", "—"];

function drawCharacterThumbnail(character: CharacterContent): string {
  const canvas = document.createElement("canvas");
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = character.bodyColor;
  ctx.beginPath();
  ctx.arc(100, 100, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "80px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(character.face, 100, 100);
  ctx.font = "48px sans-serif";
  ctx.fillText(character.hair, 100, 40);
  ctx.fillText(character.outfit, 60, 160);
  if (character.accessory !== "—") ctx.fillText(character.accessory, 140, 160);
  return canvas.toDataURL("image/png");
}

export default function CharacterBuilder() {
  const { projectId } = useParams<{ projectId: string }>();
  const isNew = !projectId || projectId === "new";
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: project } = useProjectById(isNew ? undefined : projectId);
  const createProject = useCreateProject();
  const saveProject = useSaveProject();
  const setPublic = useSetProjectPublic();

  const [title, setTitle] = useState(t("kids.studio.myCharacter"));
  const [savedId, setSavedId] = useState<string | undefined>(isNew ? undefined : projectId);
  const [character, setCharacter] = useState<CharacterContent>({
    bodyColor: BODY_COLORS[0], hair: HAIR_OPTIONS[0], face: FACE_OPTIONS[0], outfit: OUTFIT_OPTIONS[0], accessory: ACCESSORY_OPTIONS[5],
  });

  useDocumentHead({ title: t("kids.studio.characterBuilderTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/character-builder" });

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setCharacter({ ...character, ...jsonAs<Partial<CharacterContent>>(project.content) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const handleSave = async () => {
    const thumbnailUrl = drawCharacterThumbnail(character);
    if (!savedId) {
      const created = await createProject.mutateAsync({ projectType: "character", title, thumbnailUrl, content: character });
      setSavedId(created.id);
      navigate(`/kids/studio/character-builder/${created.id}`, { replace: true });
    } else {
      await saveProject.mutateAsync({ id: savedId, title, thumbnailUrl, content: character });
    }
  };

  const OptionRow = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={value === opt}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-2xl ${value === opt ? "border-kids-primary bg-kids-primary/10" : "border-border hover:bg-muted"}`}
            style={opt.startsWith("#") ? { backgroundColor: opt } : undefined}
          >
            {opt.startsWith("#") ? null : opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />
        {(saveProject.isPending || createProject.isPending) && <AutoSaveIndicator saving />}
      </div>

      <div className="mt-4 flex justify-center">
        <div
          className="flex h-40 w-40 items-center justify-center rounded-full text-7xl"
          style={{ backgroundColor: character.bodyColor }}
          role="img"
          aria-label={t("kids.studio.characterPreview")}
        >
          {character.face}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t("kids.studio.skinTone")}</p>
          <div role="group" aria-label={t("kids.studio.skinTone")} className="flex gap-2">
            {BODY_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setCharacter((prev) => ({ ...prev, bodyColor: c }))} aria-pressed={character.bodyColor === c} aria-label={c} className={`h-9 w-9 rounded-full border-2 ${character.bodyColor === c ? "border-kids-primary" : "border-border"}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <OptionRow label={t("kids.studio.hair")} options={HAIR_OPTIONS} value={character.hair} onChange={(v) => setCharacter((p) => ({ ...p, hair: v }))} />
        <OptionRow label={t("kids.studio.face")} options={FACE_OPTIONS} value={character.face} onChange={(v) => setCharacter((p) => ({ ...p, face: v }))} />
        <OptionRow label={t("kids.studio.outfit")} options={OUTFIT_OPTIONS} value={character.outfit} onChange={(v) => setCharacter((p) => ({ ...p, outfit: v }))} />
        <OptionRow label={t("kids.studio.accessory")} options={ACCESSORY_OPTIONS} value={character.accessory} onChange={(v) => setCharacter((p) => ({ ...p, accessory: v }))} />
      </div>

      <Button onClick={handleSave} className="mt-6 gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
        <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.saveCharacter")}
      </Button>

      {project && (
        <div className="mt-4">
          <ParentalGate project={project} onToggle={(next) => setPublic.mutate({ id: project.id, isPublic: next })} />
        </div>
      )}
    </div>
  );
}
