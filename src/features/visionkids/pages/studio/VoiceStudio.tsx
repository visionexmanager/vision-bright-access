import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Mic, Square, Play, Save, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useCreateProject, useUploadStudioAsset, useSaveProject } from "@/features/visionkids/hooks/studio/useStudioProjects";
import { useTextToSpeech, useSpeechToText } from "@/features/visionkids/hooks/studio/useVoiceTools";

export default function VoiceStudio() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const createProject = useCreateProject();
  const uploadAsset = useUploadStudioAsset();
  const saveProject = useSaveProject();
  const textToSpeech = useTextToSpeech();
  const speechToText = useSpeechToText();

  const [title, setTitle] = useState(t("kids.studio.myRecording"));
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [reduceNoise, setReduceNoise] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useDocumentHead({ title: t("kids.studio.voiceStudioTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/voice-studio" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  const startRecording = async () => {
    setSaved(false);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setRecordedBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((tr) => tr.stop());
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const play = () => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speed;
    // "Reduce noise" — a real, simple high-pass filter (cuts low-frequency
    // rumble), not full spectral noise removal. Honestly labeled as such.
    if (reduceNoise) {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audioRef.current);
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 200;
      source.connect(filter);
      filter.connect(ctx.destination);
    }
    audioRef.current.play();
  };

  const handleSave = async () => {
    if (!recordedBlob) return;
    const created = await createProject.mutateAsync({ projectType: "voice", title, content: { speed, reduceNoise } });
    const url = await uploadAsset.mutateAsync({ file: recordedBlob, projectId: created.id, filename: "voice.webm" });
    await saveProject.mutateAsync({ id: created.id, assetUrls: [url], saveVersion: false });
    setSaved(true);
  };

  const handleTts = async () => {
    if (!ttsText.trim()) return;
    const url = await textToSpeech.mutateAsync(ttsText.trim());
    setTtsUrl(url);
  };

  const handleStt = async () => {
    if (!recordedBlob) return;
    const text = await speechToText.mutateAsync(recordedBlob);
    setTranscript(text);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link to="/kids/studio" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.homeTitle")}
      </Link>

      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">{t("kids.studio.recordTab")}</TabsTrigger>
          <TabsTrigger value="tts">{t("kids.studio.textToSpeechTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="mt-4 flex flex-col gap-4">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="max-w-xs font-heading text-lg font-bold" aria-label={t("kids.studio.projectTitle")} />

          <div className="flex items-center gap-2">
            {!recording ? (
              <Button onClick={startRecording} className="gap-1.5 bg-destructive text-white hover:bg-destructive/90">
                <Mic className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.startRecording")}
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="outline" className="gap-1.5">
                <Square className="h-4 w-4" aria-hidden="true" /> {t("kids.studio.stop")}
              </Button>
            )}
          </div>

          {audioUrl && (
            <div className="rounded-2xl border-2 border-border bg-card p-4">
              <audio ref={audioRef} src={audioUrl} className="hidden" />
              <div className="flex items-center gap-3">
                <Button size="icon" variant="outline" onClick={play} aria-label={t("kids.games.play")}><Play className="h-4 w-4" aria-hidden="true" /></Button>
                <div className="flex-1">
                  <Label htmlFor="voice-speed" className="text-xs text-muted-foreground">{t("kids.studio.playbackSpeed")}: {speed.toFixed(1)}x</Label>
                  <Slider id="voice-speed" min={0.5} max={2} step={0.1} value={[speed]} onValueChange={([v]) => setSpeed(v)} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Label htmlFor="voice-noise" className="text-sm">{t("kids.studio.reduceNoise")}</Label>
                <Switch id="voice-noise" checked={reduceNoise} onCheckedChange={setReduceNoise} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={handleSave} disabled={saved} className="gap-1.5 bg-kids-primary text-white hover:bg-kids-primary/90">
                  <Save className="h-4 w-4" aria-hidden="true" /> {saved ? t("kids.studio.saved") : t("kids.studio.save")}
                </Button>
                <Button size="sm" variant="outline" onClick={handleStt} disabled={speechToText.isPending} className="gap-1.5">
                  {speechToText.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} {t("kids.studio.speechToText")}
                </Button>
              </div>
              {transcript && <p className="mt-2 rounded-lg bg-muted p-2 text-sm">{transcript}</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tts" className="mt-4 flex flex-col gap-3">
          <Textarea value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder={t("kids.studio.ttsPlaceholder")} maxLength={500} />
          <Button onClick={handleTts} disabled={!ttsText.trim() || textToSpeech.isPending} className="self-start gap-1.5 bg-kids-secondary text-white hover:bg-kids-secondary/90">
            {textToSpeech.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />} {t("kids.studio.generateSpeech")}
          </Button>
          {ttsUrl && <audio controls src={ttsUrl} className="w-full" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
