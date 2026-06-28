import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  SPEECH_EMOTIONS,
  SPEECH_LANGUAGES,
  type SpeechEmotion,
  type OutputFormat,
  type SpeechModel,
} from "@/lib/types/speech-studio";

interface Props {
  language: string;
  emotion: SpeechEmotion;
  speed: number;
  pitch: number;
  outputFormat: OutputFormat;
  model: SpeechModel;
  disabled?: boolean;
  onChange: (patch: Partial<{
    language: string;
    emotion: SpeechEmotion;
    speed: number;
    pitch: number;
    outputFormat: OutputFormat;
    model: SpeechModel;
  }>) => void;
}

export function SpeechParameters({
  language, emotion, speed, pitch, outputFormat, model, disabled = false, onChange,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selectedEmotion = SPEECH_EMOTIONS.find((e) => e.value === emotion) ?? SPEECH_EMOTIONS[0];

  return (
    <div className="space-y-5">
      {/* Language */}
      <div className="space-y-1.5">
        <Label htmlFor="param-language" className="text-sm font-medium">Language</Label>
        <Select
          value={language}
          onValueChange={(v) => onChange({ language: v })}
          disabled={disabled}
        >
          <SelectTrigger id="param-language" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEECH_LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                <span className="flex items-center gap-2">
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                  <span className="text-muted-foreground text-xs">{l.nativeLabel}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Emotion */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Emotion / Style</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {SPEECH_EMOTIONS.map((e) => (
            <button
              key={e.value}
              onClick={() => onChange({ emotion: e.value })}
              disabled={disabled}
              title={e.description}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-all",
                "hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring",
                emotion === e.value
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <span className="text-lg leading-none">{e.emoji}</span>
              <span className="leading-tight text-center truncate w-full">{e.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground px-1">{selectedEmotion.description}</p>
      </div>

      {/* Speed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Speed</Label>
          <span className="text-sm font-mono text-primary">{speed.toFixed(2)}×</span>
        </div>
        <Slider
          value={[speed]}
          onValueChange={([v]) => onChange({ speed: v })}
          min={0.25}
          max={4.0}
          step={0.05}
          disabled={disabled}
          className="cursor-pointer"
          aria-label="Speech speed"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
          <span>0.25× (Slow)</span>
          <span>1× Normal</span>
          <span>4× (Fast)</span>
        </div>
      </div>

      {/* Advanced settings */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
          <Settings2 className="h-3.5 w-3.5" />
          Advanced Settings
          <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", advancedOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4">
          {/* Pitch (stored for future providers; OpenAI doesn't expose pitch) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">
                Pitch
                <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded">Future</span>
              </Label>
              <span className="text-sm font-mono text-muted-foreground">{pitch > 0 ? `+${pitch}` : pitch}</span>
            </div>
            <Slider
              value={[pitch]}
              onValueChange={([v]) => onChange({ pitch: v })}
              min={-20}
              max={20}
              step={1}
              disabled
              className="opacity-50 cursor-not-allowed"
              aria-label="Pitch adjustment (future)"
            />
            <p className="text-[10px] text-muted-foreground">Pitch adjustment will be available with supported providers.</p>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label htmlFor="param-model" className="text-sm font-medium">TTS Model</Label>
            <Select
              value={model}
              onValueChange={(v) => onChange({ model: v as SpeechModel })}
              disabled={disabled}
            >
              <SelectTrigger id="param-model" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tts-1">tts-1 — Standard (faster)</SelectItem>
                <SelectItem value="tts-1-hd">tts-1-hd — HD quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Output Format */}
          <div className="space-y-1.5">
            <Label htmlFor="param-format" className="text-sm font-medium">Output Format</Label>
            <Select
              value={outputFormat}
              onValueChange={(v) => onChange({ outputFormat: v as OutputFormat })}
              disabled={disabled}
            >
              <SelectTrigger id="param-format" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp3">MP3 — Best compatibility</SelectItem>
                <SelectItem value="wav">WAV — Lossless</SelectItem>
                <SelectItem value="flac">FLAC — Lossless compressed</SelectItem>
                <SelectItem value="opus">Opus — Best compression</SelectItem>
                <SelectItem value="aac">AAC — Apple compatible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
