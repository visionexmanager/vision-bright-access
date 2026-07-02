import { useState, useMemo } from "react";
import { StudioLayout } from "./StudioLayout";
import { useAMSProjects } from "@/hooks/useAMSProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Search,
  FolderOpen,
  LayoutGrid,
  List,
  Star,
  Archive,
} from "lucide-react";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProjectCard } from "./components/ProjectCard";
import { cn } from "@/lib/utils";
import type { ProjectStatus, ProjectSortKey } from "@/lib/types/ai-media-studio";

type TabValue = "all" | "favorites" | "archived";

export default function Projects() {
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProjectSortKey>("updated_at");

  const statusForTab: Record<TabValue, ProjectStatus | undefined> = {
    all: "active",
    favorites: "active",
    archived: "archived",
  };

  const { projects, isLoading } = useAMSProjects({
    status: statusForTab[tab],
    sort,
    query: search || undefined,
    is_favorite: tab === "favorites" ? true : undefined,
  });

  const tabCounts = useMemo(() => ({
    all: projects.filter((p) => p.status === "active").length,
    favorites: projects.filter((p) => p.is_favorite).length,
    archived: projects.filter((p) => p.status === "archived").length,
  }), [projects]);

  return (
    <StudioLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage all your AI media projects
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search projects"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as ProjectSortKey)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated_at">Last modified</SelectItem>
                <SelectItem value="created_at">Date created</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button
                className={cn("p-2 transition-colors", view === "grid" ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                className={cn("p-2 transition-colors", view === "list" ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              <FolderOpen className="h-4 w-4" />
              All
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tabCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="gap-1.5">
              <Star className="h-4 w-4" />
              Favorites
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tabCounts.favorites}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1.5">
              <Archive className="h-4 w-4" />
              Archived
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        {isLoading ? (
          <ProjectSkeleton view={view} />
        ) : projects.length === 0 ? (
          <EmptyProjects onNew={() => setCreateOpen(true)} tab={tab} search={search} />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} compact />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </StudioLayout>
  );
}

function ProjectSkeleton({ view }: { view: "grid" | "list" }) {
  return view === "grid" ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-52 rounded-xl" />
      ))}
    </div>
  ) : (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}

function EmptyProjects({
  onNew,
  tab,
  search,
}: {
  onNew: () => void;
  tab: TabValue;
  search: string;
}) {
  const isSearch = !!search;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4 border border-dashed rounded-2xl">
      <div className="p-4 rounded-full bg-muted">
        {tab === "favorites" ? (
          <Star className="h-8 w-8 text-muted-foreground" />
        ) : tab === "archived" ? (
          <Archive className="h-8 w-8 text-muted-foreground" />
        ) : (
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-lg font-semibold">
          {isSearch
            ? "No projects match your search"
            : tab === "favorites"
            ? "No favorites yet"
            : tab === "archived"
            ? "No archived projects"
            : "No projects yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {isSearch
            ? "Try different keywords or clear the search"
            : tab === "favorites"
            ? "Star a project to pin it here"
            : tab === "archived"
            ? "Archived projects will appear here"
            : "Create your first project to get started"}
        </p>
      </div>
      {tab === "all" && !isSearch && (
        <Button onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      )}
    </div>
  );
}
