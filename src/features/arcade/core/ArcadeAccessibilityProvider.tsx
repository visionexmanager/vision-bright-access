/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share one context */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readGameSettings } from "./gameSettings";

type Priority = "polite" | "assertive";
type AccessibilityContextValue = { announce: (message: string, priority?: Priority) => void };
const Context = createContext<AccessibilityContextValue>({ announce: () => undefined });

export function ArcadeAccessibilityProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");
  const announce = useCallback((message: string, priority: Priority = "polite") => {
    if (priority === "assertive") setAssertive(""); else setPolite("");
    window.setTimeout(() => priority === "assertive" ? setAssertive(message) : setPolite(message), 20);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const settings = readGameSettings();
      if (!settings.keyboardMode || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "?") announce("Game help is available from the information panel.");
      if (event.key.toLowerCase() === "s" && settings.screenReaderMode) announce("Screen reader mode is active.");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [announce]);

  useEffect(() => {
    const onGameplay = (event: Event) => {
      const detail = (event as CustomEvent<{ message:string; priority:Priority }>).detail;
      if (detail?.message) announce(detail.message, detail.priority);
    };
    window.addEventListener("visionex:accessible-gameplay", onGameplay);
    return () => window.removeEventListener("visionex:accessible-gameplay", onGameplay);
  }, [announce]);

  const value = useMemo(() => ({ announce }), [announce]);
  return <Context.Provider value={value}>{children}<div className="sr-only" aria-live="polite" aria-atomic="true">{polite}</div><div className="sr-only" aria-live="assertive" aria-atomic="true">{assertive}</div></Context.Provider>;
}

export const useArcadeAccessibility = () => useContext(Context);
