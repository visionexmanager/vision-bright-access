import { useRef } from "react";
import { Music, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAMSAssets } from "@/hooks/useAMSAssets";
import type { AudioMode } from "@/lib/types/video-studio";

interface AudioAttachmentProps {
  mode:          AudioMode;
  assetId:       string;
  onChange:      (mode: AudioMode, assetId?: string) => void;
  generatedAssets?: { id: string; name: string }[];
}

export function AudioAttachment({ mode, assetId, onChange, generatedAssets = [] }: AudioAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    assets: storedAudio,
    isLoading,
    uploads,
    uploadFiles,
  } = useAMSAssets({ asset_type: "audio", status: "ready" });

  const audioAssets = [
    ...generatedAssets,
    ...storedAudio
      .filter((asset) => !generatedAssets.some((item) => item.id === asset.id))
      .map((asset) => ({ id: asset.id, name: asset.original_name })),
  ];
  const isUploading = uploads.some((upload) => upload.status === "pending" || upload.status === "uploading");

  const handleModeChange = (nextMode: AudioMode) => {
    onChange(nextMode, nextMode === "none" ? "" : assetId);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Music className="size-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Audio Track</Label>
        <span className="ml-auto text-[10px] text-muted-foreground">Optional</span>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(v) => handleModeChange(v as AudioMode)}
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
          {isLoading ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading audio assets…
            </p>
          ) : audioAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No generated audio assets found. Create audio in Speech Studio first.
            </p>
          ) : (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={assetId}
              onChange={(e) => onChange("generated", e.target.value)}
            >
              <option value="">Select generated audio…</option>
              {audioAssets.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === "uploaded" && (
        <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-4">
          <Upload className="size-6 text-muted-foreground" />
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFiles([file]);
              event.target.value = "";
            }}
            aria-label="Upload an audio track"
          />
          <p className="text-xs text-muted-foreground text-center">MP3, M4A, WAV, WEBM, or OGG — up to 100 MB</p>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-1 size-3 animate-spin" /> : <Upload className="mr-1 size-3" />}
            {isUploading ? "Uploading…" : "Choose audio file"}
          </Button>
          {audioAssets.length > 0 && (
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              value={assetId}
              onChange={(event) => onChange("uploaded", event.target.value)}
              aria-label="Select uploaded audio"
            >
              <option value="">Select uploaded audio…</option>
              {audioAssets.map((audio) => <option key={audio.id} value={audio.id}>{audio.name}</option>)}
            </select>
          )}
          {assetId && (
            <Button size="sm" variant="ghost" onClick={() => onChange("uploaded", "")}>
              <X className="mr-1 size-3" /> Clear selection
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
