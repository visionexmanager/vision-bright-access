import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import {
  detectDuplicateResources, generateContentRecommendations, generateTrainingPlan,
  type DuplicateResourceGroup, type ContentRecommendationResult, type TrainingPlanResult,
} from "@/services/library/organizationAiAdmin";

export function useOrganizationAiAdmin(orgId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResourceGroup | null>(null);
  const [recommendations, setRecommendations] = useState<ContentRecommendationResult | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanResult | null>(null);

  const runDuplicateDetection = async () => {
    setIsLoading(true);
    try {
      setDuplicates(await detectDuplicateResources(orgId));
    } catch (err) {
      toast({ title: "Couldn't check for duplicates", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const runContentRecommendations = async () => {
    setIsLoading(true);
    try {
      setRecommendations(await generateContentRecommendations(orgId));
    } catch (err) {
      toast({ title: "Couldn't generate recommendations", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const runTrainingPlan = async (groupId: string) => {
    setIsLoading(true);
    try {
      setTrainingPlan(await generateTrainingPlan(orgId, groupId));
    } catch (err) {
      toast({ title: "Couldn't generate training plan", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, duplicates, recommendations, trainingPlan, runDuplicateDetection, runContentRecommendations, runTrainingPlan };
}
