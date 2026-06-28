import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { StudioLayout } from "./StudioLayout";
import * as amsService from "@/services/ai-media-studio/amsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, Bell, Globe, HardDrive } from "lucide-react";
import { useAMSStorage } from "@/hooks/useAMSStorage";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NotifPrefs = {
  upload_complete: boolean;
  upload_failed: boolean;
  project_created: boolean;
  storage_warning: boolean;
};

type FormValues = {
  default_language: string;
  ui_theme: "system" | "light" | "dark";
  sidebar_collapsed: boolean;
  default_view: "grid" | "list";
} & NotifPrefs;

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "hi", label: "Hindi" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "tr", label: "Turkish" },
];

export default function Settings() {
  const qc = useQueryClient();
  const { usage, usedBytes, quotaBytes, percentUsed, isWarning, isCritical, assetCount, projectCount, formatBytes } =
    useAMSStorage();

  const prefsQuery = useQuery({
    queryKey: ["ams", "preferences"],
    queryFn: () => amsService.getUserPreferences(),
  });

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      amsService.upsertUserPreferences({
        default_language: values.default_language,
        notifications: {
          upload_complete: values.upload_complete,
          upload_failed: values.upload_failed,
          project_created: values.project_created,
          storage_warning: values.storage_warning,
        },
        ui_preferences: {
          theme: values.ui_theme,
          sidebar_collapsed: values.sidebar_collapsed,
          default_view: values.default_view,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ams", "preferences"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const prefs = prefsQuery.data;

  const form = useForm<FormValues>({
    defaultValues: {
      default_language: "en",
      ui_theme: "system",
      sidebar_collapsed: false,
      default_view: "grid",
      upload_complete: true,
      upload_failed: true,
      project_created: true,
      storage_warning: true,
    },
  });

  useEffect(() => {
    if (!prefs) return;
    form.reset({
      default_language: prefs.default_language,
      ui_theme: prefs.ui_preferences?.theme ?? "system",
      sidebar_collapsed: prefs.ui_preferences?.sidebar_collapsed ?? false,
      default_view: prefs.ui_preferences?.default_view ?? "grid",
      upload_complete: prefs.notifications?.upload_complete ?? true,
      upload_failed: prefs.notifications?.upload_failed ?? true,
      project_created: prefs.notifications?.project_created ?? true,
      storage_warning: prefs.notifications?.storage_warning ?? true,
    });
  }, [prefs, form]);

  const onSubmit = (values: FormValues) => saveMutation.mutate(values);

  if (prefsQuery.isLoading) {
    return (
      <StudioLayout>
        <div className="p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </StudioLayout>
    );
  }

  return (
    <StudioLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure your AI Media Studio preferences
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Language */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" /> Language
              </CardTitle>
              <CardDescription>Default language for new projects</CardDescription>
            </CardHeader>
            <CardContent>
              <Controller
                control={form.control}
                name="default_language"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" /> Notifications
              </CardTitle>
              <CardDescription>Choose what events you want to be notified about</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  { key: "upload_complete", label: "Upload completed" },
                  { key: "upload_failed", label: "Upload failed" },
                  { key: "project_created", label: "Project created" },
                  { key: "storage_warning", label: "Storage warning" },
                ] as { key: keyof NotifPrefs; label: string }[]
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={`notif-${key}`} className="cursor-pointer">
                    {label}
                  </Label>
                  <Controller
                    control={form.control}
                    name={key}
                    render={({ field }) => (
                      <Switch
                        id={`notif-${key}`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Storage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4" /> Storage
              </CardTitle>
              <CardDescription>Your storage usage and quota</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress
                value={percentUsed}
                className={cn(
                  "h-3",
                  isCritical ? "[&>div]:bg-destructive" :
                  isWarning  ? "[&>div]:bg-amber-500"   : ""
                )}
              />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{formatBytes(usedBytes)} used</span>
                <span className="text-muted-foreground">{formatBytes(quotaBytes)} total</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-muted-foreground text-xs">Projects</p>
                  <p className="text-xl font-bold mt-0.5">{projectCount}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-muted-foreground text-xs">Assets</p>
                  <p className="text-xl font-bold mt-0.5">{assetCount}</p>
                </div>
              </div>
              {isWarning && (
                <p className={cn("text-sm font-medium", isCritical ? "text-destructive" : "text-amber-500")}>
                  {isCritical
                    ? "Storage is nearly full. Delete unused assets to free up space."
                    : "You're approaching your storage limit."}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </StudioLayout>
  );
}
