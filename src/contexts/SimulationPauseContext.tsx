import { createContext, useCallback, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";

/**
 * Pausing a business simulation.
 *
 * Every simulator runs its own clocks: customers lose patience, production
 * progresses, scans tick. A person who reads with a screen reader, or who needs
 * longer to act, cannot keep up with a clock they cannot stop. The runner owns
 * one pause switch and a simulator opts in by skipping its tick while
 * `pausedRef.current` is true:
 *
 *   const { pausedRef } = useSimulationPause();
 *   setInterval(() => { if (pausedRef.current) return; ... }, 2000);
 *
 * A ref rather than state, so the running interval sees the change at once and
 * nothing has to be torn down and recreated. `paused` is for rendering.
 *
 * What this does not touch is the session clock the runner bills against. That
 * is a separate decision with a price on it, so the interface says plainly that
 * it keeps running.
 *
 * Outside a provider the hook reports "not paused", so a simulator still works
 * wherever it is mounted.
 */
interface PauseValue {
  paused: boolean;
  pausedRef: MutableRefObject<boolean>;
  toggle: () => void;
}

const NEVER: PauseValue = { paused: false, pausedRef: { current: false }, toggle: () => {} };

const PauseContext = createContext<PauseValue>(NEVER);

export function SimulationPauseProvider({ children, onChange }: { children: ReactNode; onChange?: (paused: boolean) => void }) {
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  const toggle = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    onChange?.(pausedRef.current);
  }, [onChange]);

  const value = useMemo(() => ({ paused, pausedRef, toggle }), [paused, toggle]);
  return <PauseContext.Provider value={value}>{children}</PauseContext.Provider>;
}

export function useSimulationPause(): PauseValue {
  return useContext(PauseContext);
}
