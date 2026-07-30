import { useCallback, useState, type MouseEvent, type KeyboardEvent } from "react";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

let rippleSeq = 0;

/** Click/keyboard-activation ripple effect. Renders nothing (and does no work) when reduced motion is on. */
export function useRipple() {
  const reduced = useKidsReducedMotion();
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const spawnAt = useCallback(
    (x: number, y: number, target: HTMLElement) => {
      if (reduced) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const id = ++rippleSeq;
      setRipples((prev) => [...prev, { id, x: x - rect.left - size / 2, y: y - rect.top - size / 2, size }]);
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    },
    [reduced]
  );

  const onPointerDown = useCallback(
    (e: MouseEvent<HTMLElement>) => spawnAt(e.clientX, e.clientY, e.currentTarget),
    [spawnAt]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const rect = e.currentTarget.getBoundingClientRect();
      spawnAt(rect.left + rect.width / 2, rect.top + rect.height / 2, e.currentTarget);
    },
    [spawnAt]
  );

  return { ripples, onPointerDown, onKeyDown };
}
