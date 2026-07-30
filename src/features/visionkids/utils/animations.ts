import type { Variants } from "framer-motion";

/**
 * Framer Motion variants for VisionKids. Each accepts `reduced` (from
 * useKidsReducedMotion) and collapses to an instant, transform-free
 * transition when true — Framer Motion drives transforms via WAAPI/rAF,
 * so the CSS-only `.reduce-motion` rules in index.css can't reach it;
 * every animated component must gate through these instead.
 */

export function fadeIn(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: reduced ? 0 : 0.5, ease: "easeOut" } },
  };
}

export function slideUp(reduced: boolean, distance = 24): Variants {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : distance },
    visible: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: "easeOut" } },
  };
}

export function zoomIn(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.85 },
    visible: { opacity: 1, scale: 1, transition: { duration: reduced ? 0 : 0.4, ease: "easeOut" } },
  };
}

export function bounceIn(reduced: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: reduced ? 1 : 0.5 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: reduced
        ? { duration: 0 }
        : { type: "spring", stiffness: 260, damping: 14 },
    },
  };
}

/** Stagger children of a container — pass to the parent's `variants`, tag children with `visible`/`hidden`. */
export function staggerContainer(reduced: boolean, staggerChildren = 0.06): Variants {
  return {
    hidden: {},
    visible: {
      transition: reduced ? {} : { staggerChildren, delayChildren: 0.05 },
    },
  };
}

/** Gentle up/down float loop for decorative hero icons — pass a unique `custom` (0-1) for phase offset. */
export function floatLoop(reduced: boolean) {
  if (reduced) return {};
  return {
    y: [0, -10, 0],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
  };
}

/** Simple parallax transform for a scroll-linked value — caller supplies a MotionValue via useScroll. */
export function parallaxOffset(reduced: boolean, factor: number) {
  return reduced ? 0 : factor;
}

export const cardHover = (reduced: boolean) =>
  reduced
    ? {}
    : { scale: 1.04, y: -4, transition: { duration: 0.2, ease: "easeOut" as const } };

export const cardTap = (reduced: boolean) => (reduced ? {} : { scale: 0.98 });
