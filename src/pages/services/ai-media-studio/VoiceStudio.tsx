import { useState, useCallback } from "react";
import {
  Mic2, Plus, Search, Filter, Star, Grid2x2, List,
  SlidersHorizontal, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StudioLayout } from "./StudioLayout";
import { VoiceProfileCard } from "./components/voice/VoiceProfileCard";
import { VoiceProfileDetail } from "./components/voice/VoiceProfileDetail";
import { CreateVoiceProfileDialog } from "./components/voice/CreateVoiceProfileDialog";
import { useVoiceProfiles } from "@/hooks/useVoiceProfiles";
import { cn } from "@/lib/utils";
import type { VoiceProfile, VoiceProfileStatus } from "@/lib/types/voice-studio";

type ViewMode = "grid" | "list";

const STATUS_FILTERS: { value: VoiceProfileStatus | "all"; label: string }[] = [
  { value: "all",       label: "All profiles" },
  { value: "draft",     label: "Draft" },
  { value: "training",  label: "Training" },
  { value: "completed", label: "Ready" },
  { value: "failed",    label: "Failed" },
  { value: "archived",  label: "Archived" },
];

export default function VoiceStudio() {
  const {
    profiles, isLoading, filters, updateFilters, resetFilters,
    createProfile, updateProfile, archiveProfile, restoreProfile,
    duplicateProfile, toggleFavorite, deleteProfile, isCreating,
  } = useVoiceProfiles();

  const [viewMode, setViewMode]           = useState<ViewMode>("grid");
  const [createOpen, setCreateOpen]       = useState(false);
  const [detailProfile, setDetailProfile] = useState<VoiceProfile | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<VoiceProfile | null>(null);
  const [renamingProfile, setRenamingProfile] = useState<VoiceProfile | null>(null);
  const [renameVal, setRenameVal]         = useState("");

  // If a profile is open in detail view
  if (detailProfile) {
    // Find the latest version from the query (it may have changed status)
    const liveProfile = profiles.find((p) => p.id === detailProfile.id) ?? detailProfile;
    return (
      <StudioLayout>
        <VoiceProfileDetail
          profile={liveProfile}
          onBack={() => setDetailProfile(null)}
        />
      </StudioLayout>
    );
  }

  const handleRenameSubmit = () => {
    if (renamingProfile && renameVal.trim()) {
      updateProfile({ id: renamingProfile.id, input: { name: renameVal.trim() } });
    }
    setRenamingProfile(null);
    setRenameVal("");
  };

  return (
    <StudioLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mic2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Voice Studio</h1>
            <p className="text-xs text-muted-foreground">Clone and manage your voice profiles</p>
          </div>
          <Badge variant="secondary" className="ml-2 text-[10px]">Beta</Badge>
          <div className="ml-auto">
            <Button
              className="gap-1.5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Voice Profile
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b shrink-0">
          {/* Search */}
          <div className="relative flex-1 min-w-0 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search profiles…"
              value={filters.query ?? ""}
              onChange={(e) => updateFilters({ query: e.target.value || undefined })}
            />
          </div>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {STATUS_FILTERS.find((f) => f.value === (filters.status ?? "all"))?.label ?? "All"}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {STATUS_FILTERS.map((f) => (
                <DropdownMenuCheckboxItem
                  key={f.value}
                  checked={(filters.status ?? "all") === f.value}
                  onCheckedChange={() => updateFilters({ status: f.value as VoiceProfileStatus | "all" })}
                >
                  {f.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Sort
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { value: "created_at",    label: "Date created" },
                { value: "updated_at",    label: "Last updated" },
                { value: "name",          label: "Name" },
                { value: "quality_score", label: "Quality" },
              ].map((s) => (
                <DropdownMenuCheckboxItem
                  key={s.value}
                  checked={(filters.sortBy ?? "created_at") === s.value}
                  onCheckedChange={() => updateFilters({ sortBy: s.value as "name" | "created_at" | "updated_at" | "quality_score" })}
                >
                  {s.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Favorites toggle */}
          <Button
            variant={filters.showFavoritesOnly ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => updateFilters({ showFavoritesOnly: !filters.showFavoritesOnly })}
          >
            <Star className={cn("h-3.5 w-3.5", filters.showFavoritesOnly && "fill-amber-400 text-amber-400")} />
            Favorites
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <Grid2x2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className={cn(viewMode === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
              : "flex flex-col gap-3"
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-2xl" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              hasFilters={!!(filters.query || filters.status || filters.showFavoritesOnly)}
              onCreate={() => setCreateOpen(true)}
              onReset={resetFilters}
            />
          ) : (
            <div className={cn(viewMode === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
              : "flex flex-col gap-3"
            )}>
              {profiles.map((profile) => (
                <VoiceProfileCard
                  key={profile.id}
                  profile={profile}
                  onClick={() => setDetailProfile(profile)}
                  onRename={() => { setRenamingProfile(profile); setRenameVal(profile.name); }}
                  onDuplicate={() => duplicateProfile(profile.id)}
                  onArchive={() => archiveProfile(profile.id)}
                  onRestore={() => restoreProfile(profile.id)}
                  onDelete={() => setDeleteTarget(profile)}
                  onToggleFavorite={() => toggleFavorite({ id: profile.id, current: profile.is_favorite })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <CreateVoiceProfileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createProfile}
        isLoading={isCreating}
      />

      {/* Rename dialog */}
      {renamingProfile && (
        <AlertDialog open onOpenChange={(v) => { if (!v) setRenamingProfile(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rename Voice Profile</AlertDialogTitle>
              <AlertDialogDescription>Enter a new name for "{renamingProfile.name}".</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
              placeholder="New name…"
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRenameSubmit}>Rename</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <AlertDialog open onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Voice Profile?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes "{deleteTarget.name}" and all its audio samples.
                The cloned voice will also be removed from your provider account.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => { deleteProfile(deleteTarget.id); setDeleteTarget(null); }}
              >
                Delete Profile
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </StudioLayout>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  hasFilters, onCreate, onReset,
}: { hasFilters: boolean; onCreate: () => void; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
        <Mic2 className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">
          {hasFilters ? "No profiles match" : "No voice profiles yet"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {hasFilters
            ? "Try clearing your search or filters."
            : "Create your first voice profile to start cloning and using your voice in Speech Studio."}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="outline" onClick={onReset}>Clear Filters</Button>
      ) : (
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Create Voice Profile
        </Button>
      )}
    </div>
  );
}
