import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  fetchCommunityRecommendations, summarizeDiscussion, translateComment, generateReadingPlan,
  type LibraryReadingPlan,
} from "@/services/library/communityAi";

export function useCommunityRecommendations() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["library", "community-recommendations", user?.id ?? ""],
    queryFn: () => fetchCommunityRecommendations(10),
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
  });
  return { clubs: data?.clubs ?? [], friends: data?.friends ?? [], isLoading };
}

export function useDiscussionSummary(topicId: string | undefined) {
  const [summary, setSummary] = useState<{ summary: string; keyPoints: string[] } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const summarize = async () => {
    if (!topicId) return;
    setIsSummarizing(true);
    try {
      setSummary(await summarizeDiscussion(topicId));
    } catch (err) {
      toast({ title: "Couldn't summarize this discussion", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsSummarizing(false);
    }
  };

  return { summary, isSummarizing, summarize };
}

export function useCommentTranslation() {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);

  const translate = async (replyId: string, text: string, targetLanguage: string) => {
    setTranslatingId(replyId);
    try {
      const translated = await translateComment(text, targetLanguage);
      setTranslations((prev) => ({ ...prev, [replyId]: translated }));
    } catch (err) {
      toast({ title: "Couldn't translate", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setTranslatingId(null);
    }
  };

  return { translations, translatingId, translate };
}

export function useReadingPlan() {
  const [plan, setPlan] = useState<LibraryReadingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async () => {
    setIsGenerating(true);
    try {
      setPlan(await generateReadingPlan());
    } catch (err) {
      toast({ title: "Couldn't generate a reading plan", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return { plan, isGenerating, generate };
}
