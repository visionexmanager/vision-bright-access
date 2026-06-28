import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Heart, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVideoTemplates, useVideoTemplateMutations } from "@/hooks/useVideoTemplates";
import type { VideoGenerateForm, VideoTemplate } from "@/lib/types/video-studio";

interface VideoTemplateDialogProps {
  open:        boolean;
  onClose:     () => void;
  currentForm?: VideoGenerateForm;
  onLoad?:     (t: VideoTemplate) => void;
}

export function VideoTemplateDialog({
  open, onClose, currentForm, onLoad,
}: VideoTemplateDialogProps) {
  const { data: templates = [] } = useVideoTemplates();
  const { create, remove, toggleFavorite } = useVideoTemplateMutations();

  const [mode, setMode]         = useState<"list" | "save">("list");
  const [name, setName]         = useState("");
  const [description, setDesc]  = useState("");

  const handleSave = async () => {
    if (!currentForm || !name.trim()) return;
    await create.mutateAsync({
      name:            name.trim(),
      description:     description.trim() || null,
      prompt_template: currentForm.prompt,
      negative_prompt: currentForm.negativePrompt || null,
      style:           currentForm.style,
      duration_sec:    currentForm.durationSec,
      aspect_ratio:    currentForm.aspectRatio,
      resolution:      currentForm.resolution,
      fps:             currentForm.fps,
      camera_motion:   currentForm.cameraMotion,
      creativity:      currentForm.creativity,
      provider:        currentForm.provider,
      provider_model:  currentForm.providerModel,
      is_favorite:     false,
    });
    setName(""); setDesc(""); setMode("list");
  };

  const sorted = [...templates].sort((a, b) =>
    Number(b.is_favorite) - Number(a.is_favorite) || b.use_count - a.use_count
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setMode("list"); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Video Templates</DialogTitle>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="flex gap-2 border-b border-border pb-2">
          <Button
            size="sm" variant={mode === "list" ? "secondary" : "ghost"}
            onClick={() => setMode("list")}
          >
            My Templates ({templates.length})
          </Button>
          {currentForm && (
            <Button
              size="sm" variant={mode === "save" ? "secondary" : "ghost"}
              onClick={() => setMode("save")}
            >
              Save Current
            </Button>
          )}
        </div>

        {/* List */}
        {mode === "list" && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {sorted.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No templates yet. Save your current settings to create one.
              </p>
            )}
            {sorted.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer"
                onClick={() => { onLoad?.(t); onClose(); }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t.style} · {t.aspect_ratio} · {t.resolution} · used {t.use_count}×
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="icon" variant="ghost" className="size-7"
                    onClick={() => toggleFavorite.mutate({ id: t.id, value: !t.is_favorite })}
                  >
                    <Heart className={cn("size-3.5", t.is_favorite && "fill-red-400 text-red-400")} />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="size-7 text-destructive"
                    onClick={() => remove.mutate(t.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save form */}
        {mode === "save" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cinematic landscape 16:9"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Short description of this style"
                rows={2}
                maxLength={200}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("list")}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending ? "Saving…" : "Save Template"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
