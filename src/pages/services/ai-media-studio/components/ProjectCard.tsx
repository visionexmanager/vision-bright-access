import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  Star,
  StarOff,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useAMSProjects } from "@/hooks/useAMSProjects";
import { RenameProjectDialog } from "./RenameProjectDialog";
import type { AMSProject } from "@/lib/types/ai-media-studio";

interface Props {
  project: AMSProject;
  compact?: boolean;
}

export function ProjectCard({ project, compact = false }: Props) {
  const [renameOpen, setRenameOpen] = useState(false);
  const { toggleFavorite, archiveProject, restoreProject, duplicateProject, deleteProject } =
    useAMSProjects();

  const isArchived = project.status === "archived";

  const thumbnail = project.thumbnail_url ? (
    <img
      src={project.thumbnail_url}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <FolderOpen className="h-6 w-6 text-primary/60" />
  );

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/50 transition-colors group">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
            {thumbnail}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{project.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {new Date(project.updated_at).toLocaleDateString()}
              </span>
              {project.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <ProjectMenu
            project={project}
            onRename={() => setRenameOpen(true)}
            onToggleFavorite={() => toggleFavorite({ id: project.id, value: !project.is_favorite })}
            onDuplicate={() => duplicateProject(project.id)}
            onArchive={() => archiveProject(project.id)}
            onRestore={() => restoreProject(project.id)}
            onDelete={() => deleteProject(project.id)}
          />
        </div>
        <RenameProjectDialog project={project} open={renameOpen} onOpenChange={setRenameOpen} />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative rounded-xl border bg-card hover:shadow-md transition-all overflow-hidden flex flex-col",
          isArchived && "opacity-60"
        )}
      >
        <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
          {thumbnail}
        </div>
        <div className="p-4 flex-1 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{project.name}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => toggleFavorite({ id: project.id, value: !project.is_favorite })}
                aria-label={project.is_favorite ? "Remove from favorites" : "Add to favorites"}
                className="text-muted-foreground hover:text-amber-500 transition-colors"
              >
                {project.is_favorite ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="h-4 w-4" />
                )}
              </button>
              <ProjectMenu
                project={project}
                onRename={() => setRenameOpen(true)}
                onToggleFavorite={() => toggleFavorite({ id: project.id, value: !project.is_favorite })}
                onDuplicate={() => duplicateProject(project.id)}
                onArchive={() => archiveProject(project.id)}
                onRestore={() => restoreProject(project.id)}
                onDelete={() => deleteProject(project.id)}
              />
            </div>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {project.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
              {project.language.toUpperCase()}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Updated {new Date(project.updated_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <RenameProjectDialog project={project} open={renameOpen} onOpenChange={setRenameOpen} />
    </>
  );
}

function ProjectMenu({
  project,
  onRename,
  onToggleFavorite,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: {
  project: AMSProject;
  onRename: () => void;
  onToggleFavorite: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Project actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleFavorite}>
          <Star className="h-4 w-4 mr-2" />
          {project.is_favorite ? "Unfavorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {project.status === "archived" ? (
          <DropdownMenuItem onClick={onRestore}>
            <RotateCcw className="h-4 w-4 mr-2" /> Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="h-4 w-4 mr-2" /> Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
