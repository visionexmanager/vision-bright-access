import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as projects from "@/features/visionkids/services/stem/projects";
import type { ProjectKind } from "@/features/visionkids/types/stem.types";

export function useMyProjects(kind?: ProjectKind) {
  return useQuery({
    queryKey: ["kids-stem", "my-projects", kind ?? "all"],
    queryFn: () => projects.fetchMyProjects(kind),
  });
}

export function useGalleryProjects(kind?: ProjectKind) {
  return useQuery({
    queryKey: ["kids-stem", "gallery", kind ?? "all"],
    queryFn: () => projects.fetchGalleryProjects(kind),
  });
}

export function useMyLikedIds() {
  return useQuery({ queryKey: ["kids-stem", "my-likes"], queryFn: projects.fetchMyLikedIds });
}

function invalidateProjects(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-stem", "my-projects"] });
  qc.invalidateQueries({ queryKey: ["kids-stem", "gallery"] });
  qc.invalidateQueries({ queryKey: ["kids-stem", "stats"] });
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: projects.SaveProjectInput) => projects.saveProject(input),
    onSuccess: () => invalidateProjects(qc),
  });
}

export function useSubmitInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: projects.SubmitInnovationInput) => projects.submitInnovation(input),
    onSuccess: () => invalidateProjects(qc),
  });
}

export function useToggleProjectLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projects.toggleProjectLike(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-stem", "gallery"] });
      qc.invalidateQueries({ queryKey: ["kids-stem", "my-likes"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projects.deleteProject(projectId),
    onSuccess: () => invalidateProjects(qc),
  });
}

export function useSetProjectVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, isPublic }: { projectId: string; isPublic: boolean }) =>
      projects.setProjectVisibility(projectId, isPublic),
    onSuccess: () => invalidateProjects(qc),
  });
}
