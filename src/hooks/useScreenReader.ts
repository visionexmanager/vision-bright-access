import { useCallback, useEffect, useRef } from "react";

/**
 * Provides polite and assertive screen-reader announcements via hidden aria-live regions.
 * Call announce() for routine updates (score changes, step advances).
 * Call announceUrgent() for critical alerts (errors, failures, alarms).
 */
export function useScreenReader() {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const polite = document.createElement("div");
    polite.setAttribute("aria-live", "polite");
    polite.setAttribute("aria-atomic", "true");
    polite.className = "sr-only";
    document.body.appendChild(polite);
    politeRef.current = polite;

    const assertive = document.createElement("div");
    assertive.setAttribute("aria-live", "assertive");
    assertive.setAttribute("aria-atomic", "true");
    assertive.className = "sr-only";
    document.body.appendChild(assertive);
    assertiveRef.current = assertive;

    return () => {
      polite.remove();
      assertive.remove();
    };
  }, []);

  const announce = useCallback((message: string) => {
    if (!politeRef.current) return;
    politeRef.current.textContent = "";
    requestAnimationFrame(() => {
      if (politeRef.current) politeRef.current.textContent = message;
    });
  }, []);

  const announceUrgent = useCallback((message: string) => {
    if (!assertiveRef.current) return;
    assertiveRef.current.textContent = "";
    requestAnimationFrame(() => {
      if (assertiveRef.current) assertiveRef.current.textContent = message;
    });
  }, []);

  return { announce, announceUrgent };
}
