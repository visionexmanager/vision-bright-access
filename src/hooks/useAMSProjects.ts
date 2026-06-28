import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as amsService from "@/services/ai-media-studio/amsService";
import type { ProjectFilters, CreateProjectInput, UpdateProjectInput } from "@/lib/types/ai-media-studio";

export const AMS_PROJECTS_KEY = ["ams", "projects"] as const;

export function useAMSProjects(initialFilters: ProjectFilters = {}) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<ProjectFilters>(initialFilters);

  const query = useQuery({
    queryKey: [...AMS_PROJECTS_KEY, filters],
    queryFn: () => amsService.listProjects(filters),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) => amsService.createProject(input),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY });
      toast.success(`Project "${project.name}" created`);
      amsService.logActivity("create", "project", project.id, project.id);
    },
    onError: () => toast.error("Failed to create project"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      amsService.updateProject(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY }),
    onError: () => toast.error("Failed to update project"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => amsService.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY });
      toast.success("Project deleted");
    },
    onError: () => toast.error("Failed to delete project"),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => amsService.archiveProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY });
      toast.success("Project archived");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => amsService.restoreProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY });
      toast.success("Project restored");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => amsService.duplicateProject(id),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY });
      toast.success(`Duplicated as "${p.name}"`);
    },
    onError: () => toast.error("Failed to duplicate project"),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      amsService.toggleFavoriteProject(id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: AMS_PROJECTS_KEY }),
  });

  const updateFilters = useCallback((patch: Partial<ProjectFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    filters,
    updateFilters,
    createProject: createMutation.mutate,
    updateProject: updateMutation.mutate,
    deleteProject: deleteMutation.mutate,
    archiveProject: archiveMutation.mutate,
    restoreProject: restoreMutation.mutate,
    duplicateProject: duplicateMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
