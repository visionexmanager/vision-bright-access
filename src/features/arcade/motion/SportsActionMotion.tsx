import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { readGameSettings } from "@/features/arcade/core/gameSettings";

export type ArenaSportKind = "penalty" | "basketball" | "air-hockey" | "table-tennis" | "bowling" | "mini-golf";

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

  if (sport === "table-tennis") {
    return <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-b from-slate-800 to-cyan-950`}><div className="absolute inset-x-[8%] bottom-[16%] h-[46%] skew-x-[-8deg] border border-white/70 bg-blue-700/70"><span className="absolute left-1/2 h-full border-l-4 border-white/80" /></div><motion.span key={attempt} className="absolute left-[15%] top-[46%] h-4 w-4 rounded-full bg-white shadow-lg" initial={moving?{x:0,y:0}:false} animate={moving?{x:[0,150,315],y:[0,-48,scored?8:-38]}:{x:0,y:0}} transition={{duration:.62,ease:[.2,.75,.25,1]}} /></div>;
  }

  if (sport === "bowling") {
    return <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-b from-slate-900 to-amber-900`}><div className="absolute inset-x-[12%] bottom-0 h-full bg-gradient-to-t from-amber-500/45 to-amber-100/15 [clip-path:polygon(30%_100%,70%_100%,58%_0,42%_0)]" /><div className="absolute left-1/2 top-5 -translate-x-1/2 text-4xl text-white/90">♟♟♟</div><motion.span key={attempt} className="absolute bottom-3 left-[46%] h-10 w-10 rounded-full bg-slate-950 shadow-xl" initial={moving?{y:0,scale:1,rotate:0}:false} animate={moving?{y:-108,scale:.45,rotate:720}:{y:0}} transition={{duration:.76,ease:[.18,.82,.28,1]}} /></div>;
  }

  if (sport === "mini-golf") {
    return <div aria-hidden="true" className={`${sceneClasses} bg-gradient-to-b from-emerald-950 to-emerald-700`}><div className="absolute inset-x-[8%] bottom-0 h-[72%] rounded-t-[45%] border-x-8 border-stone-400/60 bg-emerald-500/35" /><span className="absolute right-[18%] top-[28%] h-20 border-l-4 border-white/80"><span className="absolute left-0 top-0 h-6 w-10 bg-amber-400 [clip-path:polygon(0_0,100%_50%,0_100%)]" /></span><span className="absolute right-[16%] bottom-[18%] h-5 w-12 rounded-[50%] bg-slate-950/80" /><motion.span key={attempt} className="absolute bottom-[20%] left-[16%] h-6 w-6 rounded-full bg-white shadow-lg" initial={moving?{x:0,y:0,rotate:0}:false} animate={moving?{left:scored?"80%":"62%",bottom:scored?"20%":"35%",rotate:620,scale:scored?.45:1}:{x:0,y:0}} transition={{duration:.82,ease:[.2,.75,.25,1]}} /></div>;
  }

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
