import { useState, useCallback, useRef } from "react";
import { Mic2, ChevronRight, Sparkles, Wand2, X, BookOpen, Upload, FileAudio, Copy, Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { StudioLayout } from "./StudioLayout";
import { TextEditor } from "./components/speech/TextEditor";
import { VoiceBrowser } from "./components/speech/VoiceBrowser";
import { VoiceCard } from "./components/speech/VoiceCard";
import { SpeechParameters } from "./components/speech/SpeechParameters";
import { GenerationStatus } from "./components/speech/GenerationStatus";
import { AudioPlayer } from "./components/speech/AudioPlayer";
import { SpeechHistoryPanel } from "./components/speech/SpeechHistoryPanel";
import { PresetPanel } from "./components/speech/PresetPanel";
import { useSpeechVoices } from "@/hooks/useSpeechVoices";
import { useSpeechGenerate } from "@/hooks/useSpeechGenerate";
import { useSpeechTranscribe } from "@/hooks/useSpeechTranscribe";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  SpeechVoice,
  SpeechEmotion,
  OutputFormat,
  SpeechModel,
  SpeechPreset,
} from "@/lib/types/speech-studio";

// ── Default state ─────────────────────────────────────────────────────────────

interface Params {
  language: string;
  emotion: SpeechEmotion;
  speed: number;
  pitch: number;
  outputFormat: OutputFormat;
  model: SpeechModel;
}

const DEFAULT_PARAMS: Params = {
  language:     "en",
  emotion:      "neutral",
  speed:        1.0,
  pitch:        0,
  outputFormat: "mp3",
  model:        "tts-1",
};

// ── Right panel tabs ──────────────────────────────────────────────────────────

type RightTab = "presets" | "history";

// ── Component ─────────────────────────────────────────────────────────────────

type StudioMode = "tts" | "stt";

export default function SpeechStudio() {
  const [studioMode, setStudioMode]       = useState<StudioMode>("tts");
  const [text, setText]                   = useState("");
  const [selectedVoice, setSelectedVoice] = useState<SpeechVoice | null>(null);
  const [params, setParams]               = useState<Params>(DEFAULT_PARAMS);
  const [voiceBrowserOpen, setVoiceBrowserOpen] = useState(false);
  const [rightTab, setRightTab]           = useState<RightTab>("presets");

  const { allVoices, recommendedVoices, toggleFavorite, favoriteIds } = useSpeechVoices();
  const { generate, cancel, reset, step, progress, error, audio, isGenerating } = useSpeechGenerate();

  // Pick default voice once voices load
  const handleVoiceSelect = useCallback((voice: SpeechVoice) => {
    setSelectedVoice(voice);
  }, []);

  // Use the first recommended if none selected
  const effectiveVoice = selectedVoice ?? recommendedVoices[0] ?? null;

  const patchParams = useCallback((patch: Partial<Params>) => {
    setParams((p) => ({ ...p, ...patch }));
  }, []);

  const canGenerate = !!text.trim() && !!effectiveVoice && !isGenerating;

  const handleGenerate = useCallback(() => {
    if (!canGenerate || !effectiveVoice) return;
    generate({
      text,
      voice:        effectiveVoice,
      language:     params.language,
      emotion:      params.emotion,
      speed:        params.speed,
      pitch:        params.pitch,
      outputFormat: params.outputFormat,
      model:        params.model,
    });
  }, [canGenerate, effectiveVoice, generate, text, params]);

  const loadPreset = useCallback((preset: SpeechPreset) => {
    setParams({
      language:     preset.language,
      emotion:      preset.emotion,
      speed:        preset.speed,
      pitch:        preset.pitch,
      outputFormat: preset.output_format as OutputFormat,
      model:        preset.model as SpeechModel,
    });
    // Find voice in allVoices
    const v = allVoices.find((v) => v.id === preset.voice_id);
    if (v) setSelectedVoice(v);
  }, [allVoices]);

  return (
    <StudioLayout>
      <div className="flex flex-col h-full">
        {/* Page header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mic2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Speech Studio</h1>
            <p className="text-xs text-muted-foreground">
              {studioMode === "tts" ? "Text-to-Speech · Powered by OpenAI TTS" : "Speech-to-Text · Powered by OpenAI Whisper"}
            </p>
          </div>
          <Badge variant="secondary" className="ml-2 text-[10px]">Beta</Badge>

          {/* Mode toggle */}
          <div className="ml-4 flex rounded-lg border p-0.5" role="tablist" aria-label="Speech Studio mode">
            <button
              role="tab"
              aria-selected={studioMode === "tts"}
              onClick={() => setStudioMode("tts")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                studioMode === "tts" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Text to Speech
            </button>
            <button
              role="tab"
              aria-selected={studioMode === "stt"}
              onClick={() => setStudioMode("stt")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                studioMode === "stt" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Speech to Text
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {studioMode === "tts" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setVoiceBrowserOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Browse Voices
              </Button>
            )}
          </div>
        </div>

        {studioMode === "stt" ? (
          <SpeechToTextPanel />
        ) : (
        /* Three-panel layout */
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left: Editor + Voice ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Text editor */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Script</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => { setText(""); localStorage.removeItem("ams_speech_draft"); }}
                    disabled={!text}
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                </div>
                <TextEditor
                  value={text}
                  onChange={setText}
                  speed={params.speed}
                  disabled={isGenerating}
                />
              </section>

              <Separator />

              {/* Voice selection */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Voice</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setVoiceBrowserOpen(true)}
                  >
                    <BookOpen className="h-3 w-3" />
                    Browse all
                  </Button>
                </div>

                {effectiveVoice ? (
                  <VoiceCard
                    voice={{ ...effectiveVoice, is_favorite: favoriteIds.has(effectiveVoice.id) }}
                    isSelected
                    onSelect={() => setVoiceBrowserOpen(true)}
                    onToggleFavorite={toggleFavorite}
                    compact
                  />
                ) : (
                  <button
                    onClick={() => setVoiceBrowserOpen(true)}
                    className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    <Sparkles className="h-4 w-4" />
                    Click to choose a voice
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </button>
                )}
              </section>

              <Separator />

              {/* Parameters */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Parameters</h2>
                <SpeechParameters
                  {...params}
                  disabled={isGenerating}
                  onChange={patchParams}
                />
              </section>

              {/* Generate button */}
              <div className="sticky bottom-0 bg-background pt-4 pb-6">
                <Button
                  className="w-full h-12 text-base gap-2 font-semibold"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                >
                  {isGenerating ? (
                    <>
                      <Wand2 className="h-4 w-4 animate-pulse" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Audio
                    </>
                  )}
                </Button>
                {isGenerating && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs text-muted-foreground"
                    onClick={cancel}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ── Center: Output ── */}
          <div className="w-80 xl:w-96 shrink-0 border-l border-r flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b shrink-0">
              <h2 className="text-sm font-semibold">Output</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(isGenerating || step === "failed") && step !== "idle" && (
                <GenerationStatus step={step} progress={progress} error={error} />
              )}

              {audio && step === "completed" && (
                <AudioPlayer audio={audio} onReset={reset} />
              )}

              {step === "idle" && !audio && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Wand2 className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">No audio yet</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                      Enter your text, choose a voice, and click Generate.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Presets + History ── */}
          <div className="w-64 xl:w-72 shrink-0 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b shrink-0">
              {(["presets", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-xs font-medium capitalize transition-colors border-b-2",
                    rightTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {rightTab === "presets" ? (
                <PresetPanel
                  className="flex-1 overflow-hidden flex flex-col"
                  current={{
                    voiceId:      effectiveVoice?.id ?? "",
                    voiceName:    effectiveVoice?.name,
                    language:     params.language,
                    emotion:      params.emotion,
                    speed:        params.speed,
                    pitch:        params.pitch,
                    outputFormat: params.outputFormat,
                    model:        params.model,
                    provider:     effectiveVoice?.provider ?? "openai",
                  }}
                  onLoad={loadPreset}
                />
              ) : (
                <SpeechHistoryPanel className="flex-1 overflow-hidden flex flex-col" />
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Voice browser sheet */}
      <VoiceBrowser
        open={voiceBrowserOpen}
        onOpenChange={setVoiceBrowserOpen}
        selectedVoiceId={effectiveVoice?.id}
        onSelect={handleVoiceSelect}
      />
    </StudioLayout>
  );
}

// ── Speech-to-Text panel ────────────────────────────────────────────────────

function SpeechToTextPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { transcribe, cancel, reset, step, error, result, isTranscribing } = useSpeechTranscribe();

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
      toast.error(`Unsupported file type: ${file.type || "unknown"}. Please upload an audio file.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error(`File (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 25 MB transcription limit.`);
      return;
    }
    setSelectedFile(file);
    reset();
  }, [reset]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const copyTranscript = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.transcriptText);
    toast.success("Transcript copied to clipboard");
  };

  const downloadTranscript = () => {
    if (!result) return;
    const blob = new Blob([result.transcriptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.filename.split(".").slice(0, -1).join(".") || "transcript"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          aria-label="Upload an audio file to transcribe"
          accept="audio/*,video/*"
          onChange={onFileChange}
        />

        {!selectedFile ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload area. Press Enter or Space to choose an audio file, or drag and drop."
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary hover:bg-muted/40"
            )}
          >
            <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="font-medium">Drop an audio file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">MP3, WAV, M4A, WEBM · Max 25 MB</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileAudio className="h-4 w-4 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" title={selectedFile.name}>{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => { setSelectedFile(null); reset(); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {!isTranscribing && step !== "completed" && (
              <Button className="w-full gap-2" onClick={() => transcribe(selectedFile)}>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                Transcribe Audio
              </Button>
            )}

            {isTranscribing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {step === "reading" ? "Reading audio file…" : "Transcribing with Whisper…"}
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            )}

            {step === "failed" && error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {result && step === "completed" && (
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Transcript</h2>
              <div className="flex items-center gap-1">
                {result.detectedLanguage && (
                  <Badge variant="outline" className="text-[10px] mr-2">{result.detectedLanguage}</Badge>
                )}
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyTranscript}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={downloadTranscript}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed" tabIndex={0}>
              {result.transcriptText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
