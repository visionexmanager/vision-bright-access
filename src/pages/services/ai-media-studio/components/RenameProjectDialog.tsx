import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAMSProjects } from "@/hooks/useAMSProjects";
import type { AMSProject } from "@/lib/types/ai-media-studio";

const schema = z.object({ name: z.string().min(1).max(80) });
type FormValues = z.infer<typeof schema>;

interface Props {
  project: AMSProject;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function RenameProjectDialog({ project, open, onOpenChange }: Props) {
  const { updateProject } = useAMSProjects();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: project.name },
  });

  useEffect(() => {
    if (open) form.reset({ name: project.name });
  }, [open, project.name, form]);

  const onSubmit = (values: FormValues) => {
    updateProject(
      { id: project.id, input: { name: values.name.trim() } },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-input">Project Name</Label>
            <Input id="rename-input" {...form.register("name")} autoFocus />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
