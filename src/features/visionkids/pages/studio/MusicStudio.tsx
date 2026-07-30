import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Circle, Square, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreateProject, useUploadStudioAsset, useSaveProject } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { useAudioEngine } from "@/features/visionkids/components/studio/useAudioEngine";

const PIANO_NOTES = [
  { note: "C4", freq: 261.63 }, { note: "D4", freq: 293.66 }, { note: "E4", freq: 329.63 }, { note: "F4", freq: 349.23 },
  { note: "G4", freq: 392.0 }, { note: "A4", freq: 440.0 }, { note: "B4", freq: 493.88 }, { note: "C5", freq: 523.25 },
];

const ANIMALS = [
  { emoji: "🐶", freq: 180 }, { emoji: "🐱", freq: 700 }, { emoji: "🐄", freq: 90 }, { emoji: "🐦", freq: 1200 }, { emoji: "🐸", freq: 240 },
];

export default function MusicStudio() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playTone, playNoiseBurst, startRecording, stopRecording, isRecording } = useAudioEngine();
  const createProject = useCreateProject();
  const uploadAsset = useUploadStudioAsset();
  const saveProject = useSaveProject();

  const [title, setTitle] = useState(t("kids.studio.mySong"));
  const [noteCount, setNoteCount] = useState(0);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useDocumentHead({ title: t("kids.studio.musicStudioTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/music-studio" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const play = (freq: number, type: OscillatorType = "sine") => {
    playTone(freq, 500, type);
    setNoteCount((n) => n + 1);
  };

  const handleStopAndSave = async () => {
    setSaving(true);
    try {
      const blob = await stopRecording();
      const created = await createProject.mutateAsync({ projectType: "music", title, content: { noteCount } });
      const url = await uploadAsset.mutateAsync({ file: blob, projectId: created.id, filename: "recording.webm" });
      await saveProject.mutateAsync({ id: created.id, assetUrls: [url], saveVersion: false });
      setSavedProjectId(created.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <div className="flex items-center justify-between gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />
        {!isRecording ? (
          <Button size="sm" variant="outline" onClick={() => { startRecording(); setNoteCount(0); setSavedProjectId(null); }} className="gap-1.5">
            <Circle className="h-3.5 w-3.5 fill-destructive text-destructive" aria-hidden="true" /> {t("kids.studio.startRecording")}
          </Button>
        ) : (
          <Button size="sm" onClick={handleStopAndSave} disabled={saving} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Square className="h-3.5 w-3.5" aria-hidden="true" />} {t("kids.studio.stopAndSave")}
          </Button>
        )}
      </div>

      {savedProjectId && (
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-kids-green"><Save className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.songSaved")}</p>
      )}

      <Tabs defaultValue="piano" className="mt-6">
        <TabsList>
          <TabsTrigger value="piano">{t("kids.studio.piano")}</TabsTrigger>
          <TabsTrigger value="drums">{t("kids.studio.drums")}</TabsTrigger>
          <TabsTrigger value="animals">{t("kids.studio.animalSounds")}</TabsTrigger>
        </TabsList>

        <TabsContent value="piano" className="mt-4">
          <div className="flex gap-1.5">
            {PIANO_NOTES.map((n) => (
              <button
                key={n.note}
                type="button"
                onClick={() => play(n.freq)}
                aria-label={`${t("kids.studio.playNote")} ${n.note}`}
                className="flex h-32 flex-1 items-end justify-center rounded-lg border-2 border-border bg-white pb-2 text-xs font-bold text-foreground shadow transition-transform hover:scale-95 active:scale-90"
              >
                {n.note}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="drums" className="mt-4">
          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={() => { playNoiseBurst(200, 100); setNoteCount((n) => n + 1); }} className="rounded-2xl border-2 border-border bg-card p-6 text-3xl hover:bg-muted active:scale-95">🥁</button>
            <button type="button" onClick={() => { playNoiseBurst(120, 2000); setNoteCount((n) => n + 1); }} className="rounded-2xl border-2 border-border bg-card p-6 text-3xl hover:bg-muted active:scale-95">🪘</button>
            <button type="button" onClick={() => { playNoiseBurst(60, 6000); setNoteCount((n) => n + 1); }} className="rounded-2xl border-2 border-border bg-card p-6 text-3xl hover:bg-muted active:scale-95">🎶</button>
          </div>
        </TabsContent>

        <TabsContent value="animals" className="mt-4">
          <div className="grid grid-cols-5 gap-2">
            {ANIMALS.map((a) => (
              <button key={a.emoji} type="button" onClick={() => play(a.freq, "sawtooth")} className="rounded-2xl border-2 border-border bg-card p-4 text-3xl hover:bg-muted active:scale-95" aria-label={a.emoji}>
                {a.emoji}
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-xs text-muted-foreground">{t("kids.studio.recordingHint")}</p>
    </div>
  );
}
