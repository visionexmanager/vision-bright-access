import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sparkles, ChevronDown, BookmarkPlus, Settings2, Wand2,
} from "lucide-react";
import { VideoStyleSelector } from "./VideoStyleSelector";
import { AudioAttachment } from "./AudioAttachment";
import { VideoTemplateDialog } from "./VideoTemplateDialog";
import { VideoJobStatus } from "./VideoJobStatus";
import type { VideoGenerateForm, AudioMode } from "@/lib/types/video-studio";
import type { VideoTemplate } from "@/lib/types/video-studio";
import { ASPECT_RATIOS, CAMERA_MOTIONS } from "@/lib/types/video-studio";
import type { GenerationPhase, VideoGenerationState } from "@/hooks/useVideoGenerate";

interface VideoGeneratorPanelProps {
  form:           VideoGenerateForm;
  setForm:        React.Dispatch<React.SetStateAction<VideoGenerateForm>>;
  onGenerate:     () => void;
  genState:       VideoGenerationState;
  onReset:        () => void;
}

const isActive = (phase: GenerationPhase) =>
  !["idle", "completed", "failed"].includes(phase);

export function VideoGeneratorPanel({
  form, setForm, onGenerate, genState, onReset,
}: VideoGeneratorPanelProps) {
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [showTemplates,  setShowTemplates]  = useState(false);

  const set = <K extends keyof VideoGenerateForm>(k: K, v: VideoGenerateForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const loadTemplate = (t: VideoTemplate) =>
    setForm((f) => ({
      ...f,
      prompt:        t.prompt_template,
      negativePrompt: t.negative_prompt ?? "",
      style:         t.style,
      durationSec:   t.duration_sec,
      aspectRatio:   t.aspect_ratio,
      resolution:    t.resolution,
      fps:           t.fps,
      cameraMotion:  t.camera_motion,
      creativity:    t.creativity,
      provider:      t.provider,
      providerModel: t.provider_model ?? "",
      templateId:    t.id,
    }));

  const busy = isActive(genState.phase);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">

      {/* Template button */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Video Generator</p>
        <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
          <BookmarkPlus className="mr-1.5 size-3.5" />
          Templates
        </Button>
      </div>

      {/* Style selector */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Style</Label>
        <VideoStyleSelector value={form.style} onChange={(s) => set("style", s)} />
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <Label>Prompt</Label>
        <Textarea
          value={form.prompt}
          onChange={(e) => set("prompt", e.target.value)}
          placeholder="Describe the video you want to generate…"
          rows={4}
          className="resize-none"
          disabled={busy}
        />
        <p className="text-right text-[10px] text-muted-foreground">
          {form.prompt.length} chars
        </p>
      </div>

      {/* Quick settings row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Aspect ratio</Label>
          <Select value={form.aspectRatio} onValueChange={(v) => set("aspectRatio", v as VideoGenerateForm["aspectRatio"])}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label} <span className="text-muted-foreground text-[10px] ml-1">{a.description.split("/")[0].trim()}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Duration</Label>
          <div className="flex items-center gap-2">
            <Slider
              value={[form.durationSec]}
              min={3} max={30} step={1}
              onValueChange={(v) => set("durationSec", v[0])}
              className="flex-1"
              disabled={busy}
            />
            <Badge variant="outline" className="shrink-0 text-xs">
              {form.durationSec}s
            </Badge>
          </div>
        </div>
      </div>

      {/* Creativity slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Creativity</Label>
          <span className="text-xs text-muted-foreground">{form.creativity.toFixed(1)}</span>
        </div>
        <Slider
          value={[form.creativity]}
          min={1} max={10} step={0.5}
          onValueChange={(v) => set("creativity", v[0])}
          disabled={busy}
        />
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Advanced settings */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-1.5">
              <Settings2 className="size-3.5" />
              Advanced settings
            </span>
            <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Negative prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs">Negative prompt</Label>
            <Textarea
              value={form.negativePrompt}
              onChange={(e) => set("negativePrompt", e.target.value)}
              placeholder="What to avoid in the video…"
              rows={2}
              className="resize-none text-sm"
              disabled={busy}
            />
          </div>

          {/* Resolution & FPS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Resolution</Label>
              <Select value={form.resolution} onValueChange={(v) => set("resolution", v as VideoGenerateForm["resolution"])}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["480p","720p","1080p","4k"] as const).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Frame rate</Label>
              <Select value={String(form.fps)} onValueChange={(v) => set("fps", Number(v) as VideoGenerateForm["fps"])}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[24, 30, 60].map((f) => (
                    <SelectItem key={f} value={String(f)}>{f} fps</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Camera motion */}
          <div className="space-y-1">
            <Label className="text-xs">Camera motion</Label>
            <Select value={form.cameraMotion} onValueChange={(v) => set("cameraMotion", v as VideoGenerateForm["cameraMotion"])}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMERA_MOTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.emoji} {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title & seed */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="My video"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seed (optional)</Label>
              <Input
                type="number"
                value={form.seed}
                onChange={(e) => set("seed", e.target.value)}
                placeholder="Random"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Audio attachment */}
      <AudioAttachment
        mode={form.audioMode}
        assetId={form.audioAssetId}
        onChange={(mode: AudioMode, assetId?: string) => {
          set("audioMode", mode);
          if (assetId !== undefined) set("audioAssetId", assetId);
        }}
      />

      {/* Status */}
      <VideoJobStatus
        phase={genState.phase}
        progress={genState.progress}
        elapsedSec={genState.elapsedSec}
        errorMessage={genState.errorMessage}
      />

      {/* Generate / Reset */}
      {busy ? (
        <Button variant="outline" onClick={onReset} className="w-full">
          Cancel generation
        </Button>
      ) : genState.phase === "completed" ? (
        <Button onClick={onReset} variant="outline" className="w-full">
          <Wand2 className="mr-2 size-4" />
          Generate another
        </Button>
      ) : (
        <Button
          onClick={onGenerate}
          disabled={!form.prompt.trim()}
          className="w-full"
          size="lg"
        >
          <Sparkles className="mr-2 size-4" />
          Generate Video
        </Button>
      )}

      {/* Templates dialog */}
      <VideoTemplateDialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        currentForm={form}
        onLoad={loadTemplate}
      />
    </div>
  );
}
