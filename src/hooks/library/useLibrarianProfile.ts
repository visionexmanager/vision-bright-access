import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchReadingHistoryCounts, fetchEngagementCounts, fetchFavoritesSnapshot,
  fetchFavoriteTopics, addFavoriteTopic, removeFavoriteTopic,
  fetchCourseProgress, fetchCertificateSummaries, fetchResearchProjectSummaries,
} from "@/services/library/librarianProfile";
import { fetchSkills, addSkill, updateSkillLevel, removeSkill, type LibrarySkillLevel } from "@/services/library/librarianSkills";
import { toast } from "@/hooks/use-toast";

/** Composes many small, independently-cacheable queries into one Personal
 *  Profile view — deliberately not a single mega-RPC (matches this app's
 *  established pattern of composing several useQuery calls per detail page,
 *  e.g. useKgEntity, useResearchProject). */
export function useLibrarianProfile() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const queryClient = useQueryClient();

  const { data: readingHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: queryKeys.library.librarianReadingHistory(uid),
    queryFn: () => fetchReadingHistoryCounts(uid),
    enabled: !!user,
  });

  const { data: engagement, isLoading: isLoadingEngagement } = useQuery({
    queryKey: queryKeys.library.librarianEngagement(uid),
    queryFn: () => fetchEngagementCounts(uid),
    enabled: !!user,
  });

  const { data: favorites } = useQuery({
    queryKey: queryKeys.library.librarianFavorites(uid),
    queryFn: () => fetchFavoritesSnapshot(uid),
    enabled: !!user,
  });

  const { data: favoriteTopics = [] } = useQuery({
    queryKey: queryKeys.library.librarianFavoriteTopics(uid),
    queryFn: () => fetchFavoriteTopics(uid),
    enabled: !!user,
  });

  const { data: courses = [] } = useQuery({
    queryKey: queryKeys.library.librarianCourses(uid),
    queryFn: () => fetchCourseProgress(uid),
    enabled: !!user,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: queryKeys.library.librarianCertificates(uid),
    queryFn: () => fetchCertificateSummaries(uid),
    enabled: !!user,
  });

  const { data: researchProjects = [] } = useQuery({
    queryKey: queryKeys.library.librarianResearchProjects(uid),
    queryFn: () => fetchResearchProjectSummaries(uid),
    enabled: !!user,
  });

  const { data: skills = [] } = useQuery({
    queryKey: queryKeys.library.librarianSkills(uid),
    queryFn: () => fetchSkills(uid),
    enabled: !!user,
  });

  const toggleFavoriteTopic = async (entityId: string, isFavorited: boolean) => {
    if (!user) return;
    try {
      if (isFavorited) await removeFavoriteTopic(user.id, entityId);
      else await addFavoriteTopic(user.id, entityId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianFavoriteTopics(uid) });
    } catch (err) {
      toast({ title: "Couldn't update favorite topic", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const createSkill = async (skillName: string, level: LibrarySkillLevel = "beginner") => {
    if (!user || !skillName.trim()) return;
    try {
      await addSkill(user.id, skillName.trim(), level);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianSkills(uid) });
    } catch (err) {
      toast({ title: "Couldn't add skill", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const setSkillLevel = async (skillId: string, level: LibrarySkillLevel) => {
    try {
      await updateSkillLevel(skillId, level);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianSkills(uid) });
    } catch (err) {
      toast({ title: "Couldn't update skill", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const deleteSkill = async (skillId: string) => {
    try {
      await removeSkill(skillId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.librarianSkills(uid) });
    } catch (err) {
      toast({ title: "Couldn't remove skill", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return {
    readingHistory, engagement, favorites, favoriteTopics, courses, certificates, researchProjects, skills,
    isLoading: isLoadingHistory || isLoadingEngagement,
    toggleFavoriteTopic, createSkill, setSkillLevel, deleteSkill,
  };
}
