import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import type { SimulationConfig } from "@/features/visionkids/types/stem.types";

/** Client-rendered educational simulations. Each `type` is a small, safe,
 *  parametric interactive — no real-world procedure, just play-and-learn.
 *  `onInteract` lets the parent count a meaningful interaction toward
 *  completing the experiment. */
export function SimulationStage({
  config,
  onInteract,
}: {
  config: SimulationConfig;
  onInteract?: () => void;
}) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  const shell = (children: ReactNode) => (
    <div className="rounded-2xl border-2 border-border bg-card p-5">
      {config.goal && <p className="mb-3 text-sm text-muted-foreground">🎯 {config.goal}</p>}
      {children}
    </div>
  );

  switch (config.type) {
    case "gravity":
      return shell(<GravitySim reduced={reduced} onInteract={onInteract} t={t} />);
    case "pendulum":
      return shell(<PendulumSim reduced={reduced} onInteract={onInteract} t={t} />);
    case "magnet":
      return shell(<MagnetSim reduced={reduced} onInteract={onInteract} t={t} />);
    case "ramp":
      return shell(<RampSim reduced={reduced} onInteract={onInteract} t={t} />);
    case "circuit":
      return shell(<CircuitSim onInteract={onInteract} t={t} />);
    case "ph":
      return shell(<PhSim onInteract={onInteract} t={t} />);
    case "rocket":
      return shell(<RocketSim reduced={reduced} onInteract={onInteract} t={t} />);
    default:
      return null;
  }
}

type SimProps = {
  reduced?: boolean;
  onInteract?: () => void;
  t: (key: string) => string;
};

const btn = "rounded-full bg-kids-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50";
const chip = "rounded-full border-2 border-border px-3 py-1 text-sm font-semibold hover:border-kids-primary/50";

function GravitySim({ reduced, onInteract, t }: SimProps) {
  const objects = [
    { slug: "feather", emoji: "🪶", duration: 2.4 },
    { slug: "apple", emoji: "🍎", duration: 1.0 },
    { slug: "ball", emoji: "⚽", duration: 0.9 },
  ];
  const [obj, setObj] = useState(objects[1]);
  const [dropping, setDropping] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {objects.map((o) => (
          <button key={o.slug} type="button" onClick={() => setObj(o)} aria-pressed={obj.slug === o.slug}
            className={`${chip} ${obj.slug === o.slug ? "border-kids-primary bg-kids-primary/10" : ""}`}>
            {o.emoji} {t(`kids.stem.sim.object.${o.slug}`)}
          </button>
        ))}
      </div>
      <div className="relative mt-4 h-48 overflow-hidden rounded-xl bg-gradient-to-b from-kids-primary/5 to-kids-green/10">
        <motion.span
          className="absolute left-1/2 top-2 -translate-x-1/2 text-4xl"
          animate={dropping ? { top: "80%" } : { top: 8 }}
          transition={{ duration: reduced ? 0 : obj.duration, ease: "easeIn" }}
          onAnimationComplete={() => setDropping(false)}
          aria-hidden="true"
        >
          {obj.emoji}
        </motion.span>
        <div className="absolute bottom-0 h-3 w-full bg-kids-green/40" aria-hidden="true" />
      </div>
      <button type="button" className={`mt-3 ${btn}`} disabled={dropping}
        onClick={() => { setDropping(true); onInteract?.(); }}>
        {t("kids.stem.sim.drop")}
      </button>
    </div>
  );
}

function PendulumSim({ reduced, onInteract, t }: SimProps) {
  const [length, setLength] = useState(50); // 20..100
  const [swinging, setSwinging] = useState(false);
  const duration = reduced ? 0 : 0.6 + (length / 100) * 1.6;

  return (
    <div>
      <div className="relative mx-auto mt-2 h-52 w-52">
        <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-foreground" aria-hidden="true" />
        <motion.div
          className="absolute left-1/2 top-1 origin-top"
          style={{ height: length + 60 }}
          animate={swinging ? { rotate: [-35, 35, -35] } : { rotate: 0 }}
          transition={{ duration, repeat: swinging ? Infinity : 0, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <div className="mx-auto w-0.5 bg-foreground/60" style={{ height: length + 40 }} />
          <div className="mx-auto -mt-1 h-8 w-8 rounded-full bg-kids-secondary" />
        </motion.div>
      </div>
      <label className="mt-3 block text-sm font-semibold">
        {t("kids.stem.sim.length")}
        <input type="range" min={20} max={100} value={length} onChange={(e) => setLength(Number(e.target.value))}
          className="mt-1 w-full accent-kids-primary" />
      </label>
      <button type="button" className={`mt-2 ${btn}`} onClick={() => { setSwinging((s) => !s); onInteract?.(); }}>
        {swinging ? t("kids.stem.sim.stop") : t("kids.stem.sim.swing")}
      </button>
    </div>
  );
}

function MagnetSim({ reduced, onInteract, t }: SimProps) {
  const [attract, setAttract] = useState(true);

  return (
    <div>
      <div className="relative mt-2 flex h-32 items-center justify-center gap-2">
        <motion.div className="rounded-md bg-kids-pink px-4 py-6 font-bold text-white" aria-hidden="true"
          animate={{ x: attract ? 16 : -16 }} transition={{ duration: reduced ? 0 : 0.5 }}>N</motion.div>
        <motion.div className="rounded-md bg-kids-secondary px-4 py-6 font-bold text-white" aria-hidden="true"
          animate={{ x: attract ? -16 : 16 }} transition={{ duration: reduced ? 0 : 0.5 }}>
          {attract ? "S" : "N"}
        </motion.div>
      </div>
      <p className="text-center text-sm font-semibold">
        {attract ? t("kids.stem.sim.attract") : t("kids.stem.sim.repel")}
      </p>
      <button type="button" className={`mt-2 ${btn}`} onClick={() => { setAttract((a) => !a); onInteract?.(); }}>
        {t("kids.stem.sim.flip")}
      </button>
    </div>
  );
}

function RampSim({ reduced, onInteract, t }: SimProps) {
  const [height, setHeight] = useState(50); // 20..100
  const [racing, setRacing] = useState(false);
  const duration = reduced ? 0 : 1.6 - (height / 100) * 1.1;

  return (
    <div>
      <div className="relative mt-2 h-40 overflow-hidden rounded-xl bg-kids-accent/5">
        <div className="absolute bottom-0 left-0 h-1 w-full bg-kids-green/40" aria-hidden="true" />
        <motion.span className="absolute text-3xl" style={{ bottom: 4 }}
          initial={{ left: 8 }} animate={racing ? { left: "85%" } : { left: 8 }}
          transition={{ duration, ease: "linear" }} onAnimationComplete={() => setRacing(false)} aria-hidden="true">
          🏎️
        </motion.span>
      </div>
      <label className="mt-3 block text-sm font-semibold">
        {t("kids.stem.sim.rampHeight")}
        <input type="range" min={20} max={100} value={height} onChange={(e) => setHeight(Number(e.target.value))}
          className="mt-1 w-full accent-kids-primary" />
      </label>
      <button type="button" className={`mt-2 ${btn}`} disabled={racing}
        onClick={() => { setRacing(true); onInteract?.(); }}>
        {t("kids.stem.sim.race")}
      </button>
    </div>
  );
}

function CircuitSim({ onInteract, t }: SimProps) {
  const [closed, setClosed] = useState(false);
  return (
    <div>
      <div className="mt-2 flex items-center justify-center gap-4 rounded-xl bg-muted p-6">
        <span className="text-2xl" aria-hidden="true">🔋</span>
        <span className={`h-1 w-10 ${closed ? "bg-kids-accent" : "bg-border"}`} aria-hidden="true" />
        <span className={`text-4xl transition-opacity ${closed ? "opacity-100" : "opacity-30"}`} aria-hidden="true">💡</span>
        <span className={`h-1 w-10 ${closed ? "bg-kids-accent" : "bg-border"}`} aria-hidden="true" />
        <span className="text-2xl" aria-hidden="true">{closed ? "🔛" : "⭕"}</span>
      </div>
      <p className="mt-2 text-center text-sm font-semibold">
        {closed ? t("kids.stem.sim.circuitOn") : t("kids.stem.sim.circuitOff")}
      </p>
      <button type="button" className={`mt-2 ${btn}`} onClick={() => { setClosed((c) => !c); onInteract?.(); }}>
        {closed ? t("kids.stem.sim.openSwitch") : t("kids.stem.sim.closeSwitch")}
      </button>
    </div>
  );
}

function PhSim({ onInteract, t }: SimProps) {
  const [ph, setPh] = useState(7); // 1..13
  const color = ph <= 4 ? "#ef4444" : ph <= 6 ? "#ec4899" : ph <= 8 ? "#a855f7" : ph <= 10 ? "#3b82f6" : "#22c55e";
  const label = ph < 7 ? t("kids.stem.sim.acid") : ph > 7 ? t("kids.stem.sim.base") : t("kids.stem.sim.neutral");
  return (
    <div>
      <div className="mx-auto mt-2 h-28 w-20 rounded-b-2xl rounded-t-md border-2 border-border transition-colors"
        style={{ backgroundColor: color }} aria-hidden="true" />
      <p className="mt-2 text-center text-sm font-semibold">{label} (pH {ph})</p>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" className={chip} onClick={() => { setPh((p) => Math.max(1, p - 2)); onInteract?.(); }}>
          🍋 {t("kids.stem.sim.addAcid")}
        </button>
        <button type="button" className={chip} onClick={() => { setPh((p) => Math.min(13, p + 2)); onInteract?.(); }}>
          🧼 {t("kids.stem.sim.addBase")}
        </button>
      </div>
    </div>
  );
}

function RocketSim({ reduced, onInteract, t }: SimProps) {
  const [thrust, setThrust] = useState(50); // 20..100
  const [launched, setLaunched] = useState(false);
  return (
    <div>
      <div className="relative mx-auto mt-2 h-48 w-24 overflow-hidden rounded-xl bg-gradient-to-t from-kids-primary/10 to-transparent">
        <motion.span className="absolute left-1/2 -translate-x-1/2 text-4xl" style={{ bottom: 8 }}
          animate={launched ? { bottom: `${thrust}%` } : { bottom: 8 }}
          transition={{ duration: reduced ? 0 : 1.2, ease: "easeOut" }}
          onAnimationComplete={() => setLaunched(false)} aria-hidden="true">🚀</motion.span>
      </div>
      <label className="mt-3 block text-sm font-semibold">
        {t("kids.stem.sim.thrust")}
        <input type="range" min={20} max={100} value={thrust} onChange={(e) => setThrust(Number(e.target.value))}
          className="mt-1 w-full accent-kids-primary" />
      </label>
      <button type="button" className={`mt-2 ${btn}`} disabled={launched}
        onClick={() => { setLaunched(true); onInteract?.(); }}>
        {t("kids.stem.sim.launch")}
      </button>
    </div>
  );
}
