import { useState, useCallback } from "react";
import { Image, Loader2, XCircle, CheckCircle2, Download, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StudioLayout } from "./StudioLayout";
import { useImageGenerate } from "@/hooks/useImageGenerate";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = [
  { value: "dall-e-3", label: "DALL·E 3 (Recommended)", description: "Highest quality, follows prompts precisely" },
  { value: "dall-e-2", label: "DALL·E 2",               description: "Faster, lower cost" },
];

const SIZE_OPTIONS_D3 = [
  { value: "1024x1024", label: "1024 × 1024 (Square)" },
  { value: "1792x1024", label: "1792 × 1024 (Landscape)" },
  { value: "1024x1792", label: "1024 × 1792 (Portrait)" },
];

const QUALITY_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "hd",       label: "HD (Higher detail, 2× cost)" },
];

const STYLE_OPTIONS = [
  { value: "vivid",   label: "Vivid — Hyper-real & dramatic" },
  { value: "natural", label: "Natural — More subdued & realistic" },
];

const PROMPT_EXAMPLES = [
  "A serene mountain lake at golden hour, photorealistic, 8K, cinematic lighting",
  "A futuristic cityscape with flying cars and neon lights, cyberpunk style",
  "A cozy coffee shop in Paris, watercolor illustration, warm tones",
  "Abstract geometric art with deep blues and purples, minimalist style",
];

export default function ImageStudio() {
  const [prompt, setPrompt]   = useState("");
  const [model, setModel]     = useState<"dall-e-3" | "dall-e-2">("dall-e-3");
  const [size, setSize]       = useState("1024x1024");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [style, setStyle]     = useState<"vivid" | "natural">("vivid");

  const { generate, cancel, reset, step, progress, error, image, isGenerating } = useImageGenerate();

  const canGenerate = !!prompt.trim() && !isGenerating;

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    generate({ prompt: prompt.trim(), model, size, quality, style });
  }, [canGenerate, generate, prompt, model, size, quality, style]);

  const handleDownload = useCallback(async () => {
    if (!image?.imageUrl) return;
    try {
      const res  = await fetch(image.imageUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `image_${image.jobId.slice(0, 8)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(image.imageUrl, "_blank");
    }
  }, [image]);

  const isFailed    = step === "failed";
  const isCompleted = step === "completed";

  return (
    <StudioLayout>
      <div className="flex flex-col h-full max-w-5xl mx-auto p-6 gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Image className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Image Studio</h1>
            <p className="text-sm text-muted-foreground">Generate images with OpenAI DALL·E 3</p>
          </div>
          <Badge variant="secondary" className="ml-auto">DALL·E 3</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          {/* Left: Controls */}
          <div className="flex flex-col gap-4">
            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm font-medium">
                Prompt <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image you want to generate…"
                className="min-h-[120px] resize-none"
                maxLength={4000}
                disabled={isGenerating}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{prompt.length}/4000</span>
                <span>Be specific for better results</span>
              </div>
            </div>

            {/* Example prompts */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Example prompts</p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="text-[11px] rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors truncate max-w-[200px]"
                    title={ex}
                    disabled={isGenerating}
                  >
                    {ex.slice(0, 36)}…
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label className="text-sm">Model</Label>
              <Select value={model} onValueChange={(v) => setModel(v as "dall-e-3" | "dall-e-2")} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div>
                        <div className="text-sm">{m.label}</div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Size */}
            <div className="space-y-1.5">
              <Label className="text-sm">Size</Label>
              <Select value={size} onValueChange={setSize} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS_D3.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quality + Style */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Quality</Label>
                <Select value={quality} onValueChange={(v) => setQuality(v as "standard" | "hd")} disabled={isGenerating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALITY_OPTIONS.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Style</Label>
                <Select value={style} onValueChange={(v) => setStyle(v as "vivid" | "natural")} disabled={isGenerating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STYLE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Generate button */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="flex-1 gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="size-4 animate-spin" /> Generating…</>
                ) : (
                  <><Wand2 className="size-4" /> Generate Image</>
                )}
              </Button>
              {isGenerating && (
                <Button variant="outline" size="icon" onClick={cancel} title="Cancel">
                  <XCircle className="size-4" />
                </Button>
              )}
              {(isCompleted || isFailed) && (
                <Button variant="outline" size="icon" onClick={reset} title="Reset">
                  <RefreshCw className="size-4" />
                </Button>
              )}
            </div>

            {/* Progress / Status */}
            {step !== "idle" && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isGenerating && <Loader2 className="size-3.5 animate-spin text-primary" />}
                    {isCompleted  && <CheckCircle2 className="size-3.5 text-green-500" />}
                    {isFailed     && <XCircle className="size-3.5 text-destructive" />}
                    <span className={cn(
                      "font-medium",
                      isFailed    ? "text-destructive" :
                      isCompleted ? "text-green-600"   : "text-primary"
                    )}>
                      {isFailed    ? "Generation failed"     :
                       isCompleted ? "Image ready"           :
                       step === "queued" ? "Queued…"         : "Generating with DALL·E…"}
                    </span>
                  </div>
                  {!isFailed && <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>}
                </div>

                {!isFailed && (
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isCompleted ? "bg-green-500" : "bg-primary"
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {isFailed && error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive leading-relaxed">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Image preview */}
          <div className="flex flex-col gap-4">
            <div className={cn(
              "flex-1 rounded-xl border-2 border-dashed bg-muted/30 overflow-hidden transition-all",
              image ? "border-transparent" : "border-border"
            )}>
              {image ? (
                <div className="relative w-full h-full min-h-[300px]">
                  <img
                    src={image.imageUrl}
                    alt={image.revisedPrompt}
                    className="w-full h-full object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground p-8 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Image className="size-8" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No image generated yet</p>
                    <p className="text-xs">Enter a prompt and click Generate</p>
                  </div>
                </div>
              )}
            </div>

            {/* Image details */}
            {image && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Generated Image</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
                      <Download className="size-3.5" /> Download
                    </Button>
                  </div>
                </div>
                {image.revisedPrompt && image.revisedPrompt !== image.prompt && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Revised prompt by DALL·E:</p>
                    <p className="text-xs text-foreground leading-relaxed bg-muted/50 rounded-lg p-2">
                      {image.revisedPrompt}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">{image.model}</Badge>
                  <Badge variant="secondary" className="text-xs">{image.size}</Badge>
                  <Badge variant="secondary" className="text-xs">{image.quality}</Badge>
                  <Badge variant="secondary" className="text-xs">{image.style}</Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioLayout>
  );
}
