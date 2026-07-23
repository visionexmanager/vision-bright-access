import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchNotebooks, createNotebook, renameNotebook, deleteNotebook } from "@/services/library/notebooks";

export function useNotebooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.id;

  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: queryKeys.library.notebooks(uid ?? ""),
    queryFn: () => fetchNotebooks(uid!),
    enabled: !!uid,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.notebooks(uid ?? "") });

  const create = async (name: string, color?: string, icon?: string | null) => {
    if (!uid || !name.trim()) return;
    try {
      await createNotebook(uid, name.trim(), color, icon);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't create notebook", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const rename = async (notebookId: string, name: string) => {
    try {
      await renameNotebook(notebookId, name.trim());
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't rename notebook", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const remove = async (notebookId: string) => {
    try {
      await deleteNotebook(notebookId);
      invalidate();
    } catch (err) {
      toast({ title: "Couldn't delete notebook", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  return { notebooks, isLoading, create, rename, remove };
}
