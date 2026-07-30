import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/features/visionkids/utils/accessibilityPrefs";

/** Reactive read of "should motion be suppressed" — OS preference OR the manual VisionKids toggle. */
export function useKidsReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const update = () => setReduced(prefersReducedMotion());
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    mql.addEventListener("change", update);
    window.addEventListener("visionkids:a11y-change", update);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("visionkids:a11y-change", update);
    };
  }, []);

  return reduced;
}
