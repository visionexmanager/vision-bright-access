import { Music, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AudioMode } from "@/lib/types/video-studio";

interface AudioAttachmentProps {
  mode:          AudioMode;
  assetId:       string;
  onChange:      (mode: AudioMode, assetId?: string) => void;
  generatedAssets?: { id: string; name: string }[];
}

export function AudioAttachment({ mode, onChange, generatedAssets = [] }: AudioAttachmentProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Music className="size-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Audio Track</Label>
        <span className="ml-auto text-[10px] text-muted-foreground">Optional</span>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(v) => onChange(v as AudioMode)}
        className="space-y-1.5"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="none" id="audio-none" />
          <Label htmlFor="audio-none" className="text-sm cursor-pointer">No audio</Label>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem value="generated" id="audio-gen" />
          <Label htmlFor="audio-gen" className="text-sm cursor-pointer">
            Generated speech
            <span className="ml-1 text-[10px] text-muted-foreground">
              (from Speech Studio)
            </span>
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <RadioGroupItem value="uploaded" id="audio-upload" />
          <Label htmlFor="audio-upload" className="text-sm cursor-pointer">Upload audio file</Label>
        </div>
      </RadioGroup>

      {/* Generated asset picker */}
      {mode === "generated" && (
        <div className="mt-2 space-y-1.5">
          {generatedAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No generated audio assets found. Create audio in Speech Studio first.
            </p>
          ) : (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              onChange={(e) => onChange("generated", e.target.value)}
            >
              <option value="">Select generated audio…</option>
              {generatedAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Upload placeholder — subtitle says this is foundation only */}
      {mode === "uploaded" && (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4">
          <Upload className="size-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">
            Audio file upload coming soon.
            <br />
            Use a generated speech track for now.
          </p>
          <Button size="sm" variant="outline" onClick={() => onChange("none")}>
            <X className="mr-1 size-3" /> Clear
          </Button>
        </div>
      )}
    </div>
  );
}
