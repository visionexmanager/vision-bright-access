import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchResearchProjects, fetchResearchProject, createResearchProject, deleteResearchProject,
  fetchProjectMembers, inviteToProject, removeProjectMember,
  fetchProjectItems, addProjectItem, removeProjectItem, type AddProjectItemInput,
  fetchProjectComments, addProjectComment, deleteProjectComment,
  fetchProjectVersions, snapshotProject,
} from "@/services/library/researchProjects";

export function useResearchProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: queryKeys.library.researchProjects(user?.id ?? ""),
    queryFn: () => fetchResearchProjects(user!.id),
    enabled: !!user,
  });

  const create = async (title: string, description?: string) => {
    if (!user) return null;
    try {
      const project = await createResearchProject(user.id, title, description);
      void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjects(user.id) });
      return project;
    } catch (err) {
      toast({ title: "Couldn't create project", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteResearchProject(id);
      if (user) void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjects(user.id) });
    } catch (err) {
      toast({ title: "Couldn't delete project", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { projects, isLoading, create, remove };
}

export function useResearchProject(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProject(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjectMembers(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjectItems(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjectComments(projectId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.researchProjectVersions(projectId) });
  };

  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: queryKeys.library.researchProject(projectId),
    queryFn: () => fetchResearchProject(projectId),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.library.researchProjectMembers(projectId),
    queryFn: () => fetchProjectMembers(projectId),
    enabled: !!projectId,
  });

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: queryKeys.library.researchProjectItems(projectId),
    queryFn: () => fetchProjectItems(projectId),
    enabled: !!projectId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.library.researchProjectComments(projectId),
    queryFn: () => fetchProjectComments(projectId),
    enabled: !!projectId,
  });

  const { data: versions = [] } = useQuery({
    queryKey: queryKeys.library.researchProjectVersions(projectId),
    queryFn: () => fetchProjectVersions(projectId),
    enabled: !!projectId,
  });

  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? (project?.owner_id === user?.id ? "owner" : null);
  const canEdit = myRole === "owner" || myRole === "editor";

  const invite = async (email: string, role: "editor" | "viewer") => {
    try {
      const found = await inviteToProject(projectId, email, role);
      if (!found) {
        toast({ title: "No user found with that email", variant: "destructive" });
        return false;
      }
      invalidate();
      toast({ title: "Member invited" });
      return true;
    } catch (err) {
      toast({ title: "Couldn't invite member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return false;
    }
  };

  const removeMember = async (userId: string) => {
    try {
      await removeProjectMember(projectId, userId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove member", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const addItem = async (input: AddProjectItemInput) => {
    if (!user) return;
    try {
      await addProjectItem(projectId, user.id, input);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't add item", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await removeProjectItem(itemId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't remove item", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const addComment = async (body: string, itemId?: string) => {
    if (!user) return;
    try {
      await addProjectComment(projectId, user.id, body, itemId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't post comment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeComment = async (id: string) => {
    try {
      await deleteProjectComment(id);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete comment", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const snapshot = async (note?: string) => {
    try {
      await snapshotProject(projectId, note);
      invalidate();
      toast({ title: "Version saved" });
    } catch (err) {
      toast({ title: "Couldn't save version", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return {
    project, isLoadingProject, members, items, isLoadingItems, comments, versions, myRole, canEdit,
    invite, removeMember, addItem, removeItem, addComment, removeComment, snapshot,
  };
}
