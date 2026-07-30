import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as universe from "@/features/visionkids/services/events/universe";

export function useCities() {
  return useQuery({ queryKey: ["kids-events", "cities"], queryFn: universe.fetchCities });
}

export function useCityBySlug(slug: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "city", slug], queryFn: () => universe.fetchCityBySlug(slug!), enabled: !!slug });
}

export function useCharacters(citySlug: string | undefined) {
  return useQuery({ queryKey: ["kids-events", "characters", citySlug], queryFn: () => universe.fetchCharacters(citySlug!), enabled: !!citySlug });
}

export function useMyCityVisits() {
  return useQuery({ queryKey: ["kids-events", "city-visits"], queryFn: universe.fetchMyCityVisits });
}

export function useVisitCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (citySlug: string) => universe.visitCity(citySlug),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-events", "city-visits"] });
      qc.invalidateQueries({ queryKey: ["kids", "achievements"] });
    },
  });
}
