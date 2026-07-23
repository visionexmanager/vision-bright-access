import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchClubs, fetchMyClubs, createClub, type LibraryClubInput } from "@/services/library/clubs";

export function useClubBrowser() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: queryKeys.library.clubs(query),
    queryFn: () => fetchClubs(query),
  });

  const { data: myClubs = [] } = useQuery({
    queryKey: queryKeys.library.clubs(`mine:${user?.id ?? ""}`),
    queryFn: () => fetchMyClubs(user!.id),
    enabled: !!user,
  });

  const create = async (input: LibraryClubInput) => {
    if (!user) return null;
    setIsCreating(true);
    try {
      const club = await createClub(user.id, input);
      void queryClient.invalidateQueries({ queryKey: ["library", "clubs"] });
      toast({ title: "Club created" });
      return club;
    } catch (err) {
      toast({ title: "Couldn't create club", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  return { clubs, myClubs, isLoading, query, setQuery, create, isCreating };
}
