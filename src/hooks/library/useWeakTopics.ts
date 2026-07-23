import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyWeakTopics } from "@/services/library/learningQuizzes";

export function useWeakTopics() {
  const { user } = useAuth();
  const { data: weakTopics = [], isLoading } = useQuery({
    queryKey: queryKeys.library.weakTopics(user?.id ?? ""),
    queryFn: fetchMyWeakTopics,
    enabled: !!user,
  });
  return { weakTopics, isLoading };
}
