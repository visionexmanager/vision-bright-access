import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as projects from "@/features/visionkids/services/studio/projects";
import { useAwardXp, useAwardCoins, useAwardAchievement } from "@/features/visionkids/hooks/games/useGameEngagement";
import type { CreateProjectInput, SaveProjectInput } from "@/features/visionkids/services/studio/projects";
import type { ProjectType } from "@/features/visionkids/types/studio.types";

export function useMyProjects(projectType?: ProjectType) {
  return useQuery({ queryKey: ["kids-studio", "my-projects", projectType ?? "all"], queryFn: () => projects.fetchMyProjects(projectType) });
}

export function useProjectById(id: string | undefined) {
  return useQuery({ queryKey: ["kids-studio", "project", id], queryFn: () => projects.fetchProjectById(id!), enabled: !!id });
}

export function usePublicGallery(projectType?: ProjectType, limit = 30) {
  return useQuery({ queryKey: ["kids-studio", "public-gallery", projectType ?? "all", limit], queryFn: () => projects.fetchPublicGallery(projectType, limit) });
}

const ARTIST_TYPES = new Set<ProjectType>(["drawing", "sticker", "comic", "cartoon_scene"]);
const AUTHOR_TYPES = new Set<ProjectType>(["story", "book"]);

/** Creates the project, then awards XP/coins and checks the
 *  best_artist/best_author/best_musician/top_creator milestones — same
 *  "fetch a fresh count, don't trust a cached hook value" pattern as
 *  Academy's useCompleteLessonAndAward. */
export function useCreateProject() {
  const qc = useQueryClient();
  const awardXp = useAwardXp();
  const awardCoins = useAwardCoins();
  const awardAchievement = useAwardAchievement();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const project = await projects.createProject(input);
      await awardXp.mutateAsync({ amount: 15, reason: `Creative project saved: ${project.id}` }).catch(() => {});
      await awardCoins.mutateAsync({ amount: 8, reason: `Creative project saved: ${project.id}` }).catch(() => {});

      const all = await projects.fetchMyProjects();
      if (all.length >= 20) awardAchievement.mutate("top_creator");
      if (ARTIST_TYPES.has(input.projectType) && all.filter((p) => ARTIST_TYPES.has(p.project_type)).length >= 5) awardAchievement.mutate("best_artist");
      if (AUTHOR_TYPES.has(input.projectType) && all.filter((p) => AUTHOR_TYPES.has(p.project_type)).length >= 5) awardAchievement.mutate("best_author");
      if (input.projectType === "music" && all.filter((p) => p.project_type === "music").length >= 5) awardAchievement.mutate("best_musician");

      return project;
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["kids-studio", "my-projects"] });
      qc.invalidateQueries({ queryKey: ["kids-studio", "my-projects", project.project_type] });
    },
  });
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveProjectInput) => projects.saveProject(input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-studio", "project", vars.id] });
      qc.invalidateQueries({ queryKey: ["kids-studio", "my-projects"] });
      qc.invalidateQueries({ queryKey: ["kids-studio", "project-versions", vars.id] });
    },
  });
}

export function useProjectVersions(projectId: string | undefined) {
  return useQuery({ queryKey: ["kids-studio", "project-versions", projectId], queryFn: () => projects.fetchProjectVersions(projectId!), enabled: !!projectId });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projects.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-studio", "my-projects"] }),
  });
}

export function useSetProjectPublic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) => projects.setProjectPublic(id, isPublic),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kids-studio", "project", vars.id] });
      qc.invalidateQueries({ queryKey: ["kids-studio", "my-projects"] });
      qc.invalidateQueries({ queryKey: ["kids-studio", "public-gallery"] });
    },
  });
}

export function useUploadStudioAsset() {
  return useMutation({ mutationFn: ({ file, projectId, filename }: { file: Blob; projectId: string; filename: string }) => projects.uploadStudioAsset(file, projectId, filename) });
}
