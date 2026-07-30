import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyProjects, useCreateProject } from "@/features/visionkids/hooks/studio/useStudioProjects";

const BACKGROUNDS = [
  { id: "sky", label: "🌤️", className: "from-sky-300 to-sky-100" },
  { id: "forest", label: "🌳", className: "from-green-400 to-green-100" },
  { id: "space", label: "🌌", className: "from-indigo-700 to-purple-400" },
  { id: "beach", label: "🏖️", className: "from-yellow-200 to-blue-200" },
  { id: "castle", label: "🏰", className: "from-slate-400 to-slate-100" },
  { id: "night", label: "🌙", className: "from-slate-900 to-indigo-800" },
];

const SLOTS = ["left", "center", "right"] as const;

export default function CartoonCreator() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: characters = [] } = useMyProjects("character");
  const createProject = useCreateProject();

  const [title, setTitle] = useState(t("kids.studio.myScene"));
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [slots, setSlots] = useState<Record<typeof SLOTS[number], { characterId: string; dialogue: string }>>({
    left: { characterId: "", dialogue: "" },
    center: { characterId: "", dialogue: "" },
    right: { characterId: "", dialogue: "" },
  });

  useDocumentHead({ title: t("kids.studio.cartoonCreatorTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/cartoon-creator" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const findCharacter = (id: string) => characters.find((c) => c.id === id);

  const handleSave = async () => {
    const placedCharacters = SLOTS.filter((s) => slots[s].characterId).map((s, i) => ({ characterProjectId: slots[s].characterId, x: i * 33, y: 50, scale: 1 }));
    const dialogue = SLOTS.filter((s) => slots[s].dialogue).map((s) => ({ x: 0, y: 0, text: slots[s].dialogue }));
    const created = await createProject.mutateAsync({
      projectType: "cartoon_scene", title,
      content: { background: background.id, placedCharacters, dialogue },
    });
    navigate(`/kids/studio/my-projects`);
    void created;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />

      <div className="mt-4">
        <p className="mb-1.5 text-sm font-semibold">{t("kids.studio.chooseBackground")}</p>
        <div role="group" aria-label={t("kids.studio.chooseBackground")} className="flex flex-wrap gap-2">
          {BACKGROUNDS.map((bg) => (
            <button key={bg.id} type="button" onClick={() => setBackground(bg)} aria-pressed={background.id === bg.id} className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-gradient-to-br text-xl ${bg.className} ${background.id === bg.id ? "border-kids-primary" : "border-transparent"}`}>
              {bg.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`mt-4 flex h-56 items-end justify-around rounded-2xl border-2 border-border bg-gradient-to-br p-4 ${background.className}`} role="img" aria-label={t("kids.studio.scenePreview")}>
        {SLOTS.map((slot) => {
          const character = findCharacter(slots[slot].characterId);
          return (
            <div key={slot} className="flex flex-col items-center gap-1">
              {character?.thumbnail_url && <img src={character.thumbnail_url} alt="" className="h-16 w-16 rounded-full border-2 border-white object-cover shadow" />}
              {slots[slot].dialogue && <span className="rounded-full bg-white px-2 py-1 text-xs shadow">{slots[slot].dialogue}</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {SLOTS.map((slot) => (
          <div key={slot} className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border p-3">
            <span className="w-16 text-sm font-semibold capitalize">{t(`kids.studio.slot.${slot}`)}</span>
            <Select value={slots[slot].characterId} onValueChange={(v) => setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], characterId: v } }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder={t("kids.studio.chooseCharacter")} /></SelectTrigger>
              <SelectContent>{characters.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
            </Select>
            <Input
              value={slots[slot].dialogue}
              onChange={(e) => setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], dialogue: e.target.value } }))}
              placeholder={t("kids.studio.dialoguePlaceholder")}
              className="flex-1"
              maxLength={60}
            />
          </div>
        ))}
      </div>

      {characters.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{t("kids.studio.noCharactersYet")}</p>}

      <Button onClick={handleSave} className="mt-6 gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
        <Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.saveScene")}
      </Button>
    </div>
  );
}
