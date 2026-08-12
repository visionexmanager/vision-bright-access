import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

export type ArenaSportKind = "penalty" | "basketball" | "air-hockey";

type SportsActionMotionProps = {
  attempt: number;
  scored: boolean | null;
  sport: ArenaSportKind;
};

function useArcadeReducedMotion() {
  const systemReducedMotion = useReducedMotion();
  const [arcadeReducedMotion, setArcadeReducedMotion] = useState(() => readGameSettings().reducedMotion);

  useEffect(() => {
    const update = () => setArcadeReducedMotion(readGameSettings().reducedMotion);
    window.addEventListener("visionex:arcade-settings", update);
    return () => window.removeEventListener("visionex:arcade-settings", update);
  }, []);

  return Boolean(systemReducedMotion || arcadeReducedMotion);
}

const sceneClasses = "relative mx-auto mt-6 h-44 max-w-xl overflow-hidden rounded-2xl border border-white/25 bg-black/25 shadow-inner";

/** Decorative motion only: scoring remains fully deterministic in the sports engine. */
export function SportsActionMotion({ attempt, scored, sport }: SportsActionMotionProps) {
  const reducedMotion = useArcadeReducedMotion();
  const moving = attempt > 0 && !reducedMotion;
  const resultX = scored ? "82%" : "54%";

  if (sport === "basketball") {
    return (
      <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-b from-slate-800 to-amber-950`}>
        <div className="absolute bottom-0 h-1/3 w-full border-t border-amber-200/30 bg-amber-700/35" />
        <div className="absolute right-[12%] top-[24%] h-20 w-1 border-l-4 border-white/70"><span className="absolute -left-8 top-0 h-10 w-16 border-4 border-white/75" /><span className="absolute -left-7 top-9 h-1 w-14 bg-orange-500" /></div>
        <motion.span
          key={attempt}
          className="absolute bottom-[22%] left-[12%] h-7 w-7 rounded-full border-2 border-amber-950 bg-orange-500 shadow-lg"
          initial={moving ? { x:0, y:0, rotate:0 } : false}
          animate={moving ? { x:[0, 150, 310], y:[0, -105, scored ? -50 : -82], rotate:540 } : { x:0, y:0 }}
          transition={{ duration:0.82, ease:[0.25, 0.7, 0.35, 1] }}
        />
      </div>
    );
  }

  if (sport === "air-hockey") {
    return (
      <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-br from-cyan-950 via-slate-800 to-fuchsia-950`}>
        <div className="absolute inset-4 rounded-xl border-4 border-cyan-100/60 bg-slate-100/15"><span className="absolute left-1/2 h-full border-l border-cyan-100/40" /><span className="absolute -left-1 top-1/3 h-1/3 w-2 bg-fuchsia-400" /><span className="absolute -right-1 top-1/3 h-1/3 w-2 bg-cyan-300" /></div>
        <motion.span
          key={attempt}
          className="absolute left-[15%] top-[49%] h-6 w-6 rounded-full bg-slate-950 shadow-[0_0_16px_rgba(255,255,255,.65)]"
          initial={moving ? { x:0, y:0, scale:1 } : false}
          animate={moving ? { left:resultX, top:scored ? "49%" : "28%", rotate:420, scale:[1, 1.08, 1] } : { x:0, y:0 }}
          transition={{ duration:0.58, ease:[0.18, 0.82, 0.28, 1] }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-b from-sky-950 to-emerald-900`}>
      <div className="absolute inset-x-[18%] bottom-[12%] h-[62%] border-4 border-white/75 border-b-0 bg-[linear-gradient(45deg,transparent_46%,rgba(255,255,255,.18)_47%,rgba(255,255,255,.18)_53%,transparent_54%)] bg-[length:18px_18px]" />
      <motion.span
        key={attempt}
        className="absolute bottom-[18%] left-[15%] h-7 w-7 rounded-full border-2 border-slate-900 bg-white shadow-lg"
        initial={moving ? { x:0, y:0, scale:1 } : false}
        animate={moving ? { left:resultX, bottom:scored ? "55%" : "38%", rotate:560, scale:[1, 0.9, 0.72] } : { x:0, y:0 }}
        transition={{ duration:0.68, ease:[0.2, 0.75, 0.25, 1] }}
      />
    </div>
  );
}
