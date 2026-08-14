import { motion, useReducedMotion } from "framer-motion";

type ProductionWorld = "logic" | "trade" | "repair" | "music";

const paths: Record<ProductionWorld, string> = {
  logic: "M8 35 C40 8 72 62 104 34 S168 8 204 35",
  trade: "M8 42 C44 18 72 48 105 25 S165 54 204 18",
  repair: "M8 38 L42 38 L55 18 L73 52 L92 30 L118 30 L134 12 L154 46 L204 46",
  music: "M8 34 C25 6 43 62 60 34 S95 6 112 34 S147 62 164 34 S190 8 204 34",
};

export function ProductionWorldMotion({ world }: { world: ProductionWorld }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-x-5 bottom-12 h-14 overflow-hidden rounded-xl border border-white/15 bg-background/25 backdrop-blur-sm" aria-hidden="true">
      <svg viewBox="0 0 212 64" className="h-full w-full" preserveAspectRatio="none">
        <path d={paths[world]} fill="none" stroke="hsl(var(--primary) / .3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <motion.path
          d={paths[world]}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: reduceMotion ? 1 : 0, opacity: 0.75 }}
          animate={{ pathLength: 1, opacity: reduceMotion ? 0.75 : [0.55, 1, 0.55] }}
          transition={reduceMotion ? { duration: 0 } : { pathLength: { duration: 1.4, ease: "easeOut" }, opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
        />
      </svg>
    </div>
  );
}
