import { useState } from "react";
import { Star, Plus, Copy, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSpeechPresets } from "@/hooks/useSpeechPresets";
import { cn } from "@/lib/utils";
import type { SpeechPreset, SpeechEmotion, OutputFormat, SpeechModel } from "@/lib/types/speech-studio";

interface CurrentSettings {
  voiceId: string;
  voiceName?: string;
  language: string;
  emotion: SpeechEmotion;
  speed: number;
  pitch: number;
  outputFormat: OutputFormat;
  model: SpeechModel;
  provider: string;
}

interface Props {
  current: CurrentSettings;
  onLoad: (preset: SpeechPreset) => void;
  className?: string;
}

export function PresetPanel({ current, onLoad, className }: Props) {
  const { presets, isLoading, createPreset, deletePreset, duplicatePreset, toggleFavorite, isCreating } = useSpeechPresets();
  const [nameInput, setNameInput]   = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState("");
  const [showNew, setShowNew]       = useState(false);

  const handleSave = () => {
    if (!nameInput.trim()) return;
    createPreset({
      name:          nameInput.trim(),
      voice_id:      current.voiceId,
      language:      current.language,
      emotion:       current.emotion,
      speed:         current.speed,
      pitch:         current.pitch,
      output_format: current.outputFormat,
      model:         current.model,
      provider:      current.provider,
    });
    setNameInput("");
    setShowNew(false);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Star className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Presets</h3>
        <Badge variant="secondary" className="ml-auto text-[10px]">{presets.length}</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShowNew((v) => !v)}
          aria-label="Save current settings as preset"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Save new preset */}
      {showNew && (
        <div className="px-3 py-2 border-b flex gap-2 shrink-0">
          <Input
            className="h-8 text-sm"
            placeholder="Preset name…"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
          />
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={handleSave}
            disabled={!nameInput.trim() || isCreating}
          >
            Save
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-2">
            <Star className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Save your current settings as a preset to reuse them quickly.
            </p>
            <Button variant="outline" size="sm" className="mt-1" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Save current
            </Button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center gap-2 rounded-lg p-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onLoad(preset)}
              >
                {/* Favorite toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite({ id: preset.id, value: !preset.is_favorite }); }}
                  className="shrink-0 text-muted-foreground hover:text-amber-400 transition-colors"
                  aria-label={preset.is_favorite ? "Unfavorite" : "Favorite"}
                >
                  <Star className={cn("h-3.5 w-3.5", preset.is_favorite && "fill-amber-400 text-amber-400")} />
                </button>

                {/* Name (inline rename) */}
                <div className="min-w-0 flex-1">
                  {renamingId === preset.id ? (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        className="h-6 text-xs"
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            // No updatePreset by name directly — handled via useSpeechPresets
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => setRenamingId(null)} className="text-green-600">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium truncate">{preset.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {preset.voice_id.replace("openai-", "")} · {preset.speed}× · {preset.output_format.toUpperCase()}
                      </p>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Rename"
                    onClick={() => { setRenamingId(preset.id); setRenameVal(preset.name); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Duplicate"
                    onClick={() => duplicatePreset(preset.id)}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete"
                    onClick={() => deletePreset(preset.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
