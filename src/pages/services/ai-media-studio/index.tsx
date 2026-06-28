import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StudioLayout } from "./StudioLayout";
import { useAMSProjects } from "@/hooks/useAMSProjects";
import { useAMSAssets } from "@/hooks/useAMSAssets";
import { useAMSStorage } from "@/hooks/useAMSStorage";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Sparkles,
  FolderOpen,
  Mic,
  Video,
  AudioWaveform,
  TrendingUp,
  Clock,
  Star,
  HardDrive,
  ArrowRight,
  Zap,
  LayoutTemplate,
  Lock,
} from "lucide-react";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProjectCard } from "./components/ProjectCard";
import * as amsService from "@/services/ai-media-studio/amsService";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const QUICK_START_ACTIONS = [
  {
    icon: Mic,
    label: "Text to Speech",
    desc: "Convert text into natural audio",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    comingSoon: true,
  },
  {
    icon: AudioWaveform,
    label: "Voice Cloning",
    desc: "Clone a voice from audio samples",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    comingSoon: true,
  },
  {
    icon: Video,
    label: "Text to Video",
    desc: "Generate video from a script",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    comingSoon: true,
  },
  {
    icon: FolderOpen,
    label: "New Project",
    desc: "Start an empty project",
    color: "text-green-500",
    bg: "bg-green-500/10",
    action: "new-project",
  },
];

export default function AIMediaStudioDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const { projects, isLoading: projectsLoading } = useAMSProjects({ status: "active" });
  const { assets, isLoading: assetsLoading } = useAMSAssets();
  const { usage, usedBytes, quotaBytes, percentUsed, isWarning, isCritical, formatBytes } = useAMSStorage();

  const activityQuery = useQuery({
    queryKey: ["ams", "activity"],
    queryFn: () => amsService.listActivity(10),
  });

  const favorites = useMemo(() => projects.filter((p) => p.is_favorite).slice(0, 4), [projects]);
  const recent = useMemo(() => [...projects].slice(0, 6), [projects]);

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderOpen, color: "text-blue-500" },
    { label: "Assets", value: assets.length, icon: HardDrive, color: "text-violet-500" },
    { label: "Favorites", value: favorites.length, icon: Star, color: "text-amber-500" },
    { label: "Storage", value: formatBytes(usedBytes), icon: TrendingUp, color: "text-green-500" },
  ];

  const displayName =
    user?.user_metadata?.display_name || user?.user_metadata?.full_name || "Creator";

  return (
    <StudioLayout>
      <div className="p-6 space-y-8 max-w-7xl mx-auto">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/20 via-violet-500/10 to-background border p-8">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-20 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl" />
          </div>
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-primary uppercase tracking-widest">AI Media Studio</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {displayName} 👋
              </h1>
              <p className="text-muted-foreground max-w-lg">
                Your creative AI workspace. Build, manage, and organize media projects.
                AI generation engines are coming soon.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Button variant="outline" asChild>
                <Link to="/services/ai-media-studio/templates">
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  Browse Templates
                </Link>
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </section>

        {/* ── Stats row ─────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="Usage statistics">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-muted", s.color)}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    {projectsLoading || assetsLoading ? (
                      <Skeleton className="h-6 w-12 mt-1" />
                    ) : (
                      <p className="text-xl font-bold">{s.value}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* ── Quick Start ────────────────────────────────────────── */}
        <section aria-labelledby="quick-start-heading">
          <h2 id="quick-start-heading" className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Start
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_START_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.action === "new-project") setCreateOpen(true);
                  }}
                  disabled={action.comingSoon}
                  className={cn(
                    "group relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
                    action.comingSoon
                      ? "cursor-not-allowed opacity-70"
                      : "hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  )}
                >
                  <div className={cn("p-2.5 rounded-xl", action.bg)}>
                    <Icon className={cn("h-5 w-5", action.color)} aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                  </div>
                  {action.comingSoon && (
                    <Badge variant="secondary" className="absolute top-3 right-3 text-[10px] gap-0.5 px-1.5 py-0">
                      <Lock className="h-2.5 w-2.5" />Soon
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Recent Projects ─────────────────────────────────── */}
          <section aria-labelledby="recent-projects-heading" className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 id="recent-projects-heading" className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Recent Projects
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/services/ai-media-studio/projects">
                  View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {projectsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Create your first project to get started"
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {recent.map((p) => (
                  <ProjectCard key={p.id} project={p} compact />
                ))}
              </div>
            )}
          </section>

          {/* ── Right column ────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Storage */}
            <section aria-labelledby="storage-heading">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" id="storage-heading">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    Storage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress
                    value={percentUsed}
                    className={cn(
                      "h-2",
                      isCritical ? "[&>div]:bg-destructive" :
                      isWarning  ? "[&>div]:bg-amber-500"   : ""
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBytes(usedBytes)} used</span>
                    <span>{formatBytes(quotaBytes)} total</span>
                  </div>
                  {isWarning && (
                    <p className={cn("text-xs font-medium", isCritical ? "text-destructive" : "text-amber-500")}>
                      {isCritical ? "Storage nearly full!" : "Approaching storage limit"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Favorites */}
            {favorites.length > 0 && (
              <section aria-labelledby="favorites-heading">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="favorites-heading" className="text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    Favorites
                  </h2>
                </div>
                <div className="space-y-2">
                  {favorites.map((p) => (
                    <Link
                      key={p.id}
                      to={`/services/ai-media-studio/projects`}
                      className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.language.toUpperCase()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Activity */}
            <section aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Recent Activity
              </h2>
              {activityQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-lg" />
                  ))}
                </div>
              ) : activityQuery.data?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-1">
                  {activityQuery.data?.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-xs py-1.5">
                      <span className="text-primary font-medium capitalize shrink-0">{log.action}</span>
                      <span className="text-muted-foreground truncate">{log.entity_type}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </StudioLayout>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed rounded-xl gap-3">
      <div className="p-3 rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
