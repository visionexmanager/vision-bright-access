import { useQuery } from "@tanstack/react-query";
import { callVideoStudio, type VideoOptionInfo } from "@/lib/api/edgeFunctions";

export interface VideoOptions {
  available: boolean;
  options:   VideoOptionInfo[];
  balance:   number | null;
}

export const VIDEO_OPTIONS_KEY = ["video-studio", "options"] as const;

/** VX for a whole clip of `seconds` with this option. */
export const clipPrice = (option: Pick<VideoOptionInfo, "vx_per_second">, seconds: number): number =>
  option.vx_per_second * seconds;

/**
 * The priced video choices and the caller's VX balance.
 *
 * A failure is "no options": the studio then behaves as it did before, and the
 * generate call is what decides whether anything can be made.
 */
export function useVideoOptions() {
  return useQuery<VideoOptions>({
    queryKey: VIDEO_OPTIONS_KEY,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await callVideoStudio({ action: "options" });
        return {
          available: res.ok && res.available === true && (res.options?.length ?? 0) > 0,
          options:   res.options ?? [],
          balance:   typeof res.balance === "number" ? res.balance : null,
        };
      } catch {
        return { available: false, options: [], balance: null };
      }
    },
  });
}
