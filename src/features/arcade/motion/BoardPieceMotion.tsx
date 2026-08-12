import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type BoardPieceMotionProps = {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  landed?: boolean;
};

/**
 * A small, reusable physical response for board pieces. Gameplay state stays
 * deterministic; this layer only communicates lift and contact visually.
 */
export function BoardPieceMotion({ children, className, selected = false, landed = false }: BoardPieceMotionProps) {
  const reducedMotion = useReducedMotion();
  const classes = `inline-flex shrink-0 ${className ?? ""}`;
  if (reducedMotion) return <span aria-hidden="true" className={classes}>{children}</span>;

  return (
    <motion.span
      aria-hidden="true"
      className={classes}
      initial={landed ? { y:-8, scale:1.08, opacity:0.75 } : false}
      animate={{ y:selected ? -6 : 0, scale:selected ? 1.08 : 1, opacity:1 }}
      transition={landed
        ? { type:"spring", stiffness:520, damping:24, mass:0.55 }
        : { type:"spring", stiffness:420, damping:28, mass:0.6 }}
    >
      {children}
    </motion.span>
  );
}
