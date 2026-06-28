import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SPEECH_LANGUAGES } from "@/lib/types/speech-studio";
import type { CreateVoiceProfileInput, VoiceGenderOpt } from "@/lib/types/voice-studio";

const schema = z.object({
  name:        z.string().min(1, "Name is required").max(80, "Name too long"),
  description: z.string().max(300, "Too long").optional(),
  language:    z.string().default("en"),
  accent:      z.string().max(50).optional(),
  gender:      z.enum(["male", "female", "neutral", ""]).optional(),
  tags:        z.string().optional(), // comma-separated
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateVoiceProfileInput) => void;
  isLoading?: boolean;
}

export function CreateVoiceProfileDialog({ open, onOpenChange, onSubmit, isLoading }: Props) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { language: "en", gender: "" },
  });

  const submit = (values: FormValues) => {
    const tags = values.tags
      ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    onSubmit({
      name:        values.name.trim(),
      description: values.description?.trim() || undefined,
      language:    values.language,
      accent:      values.accent?.trim() || undefined,
      gender:      (values.gender as VoiceGenderOpt) || undefined,
      tags,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Voice Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vp-name">Name <span className="text-destructive">*</span></Label>
            <Input
              id="vp-name"
              placeholder="e.g. My Studio Voice"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="vp-desc">Description</Label>
            <Textarea
              id="vp-desc"
              placeholder="What is this voice for?"
              rows={2}
              {...register("description")}
            />
          </div>

          {/* Language + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Controller
                control={control}
                name="language"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEECH_LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code}>
                          {l.flag} {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Not specified</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Accent */}
          <div className="space-y-1.5">
            <Label htmlFor="vp-accent">Accent (optional)</Label>
            <Input
              id="vp-accent"
              placeholder="e.g. British, American, Australian"
              {...register("accent")}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label htmlFor="vp-tags">Tags (comma-separated)</Label>
            <Input
              id="vp-tags"
              placeholder="narration, podcast, calm"
              {...register("tags")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating…" : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
