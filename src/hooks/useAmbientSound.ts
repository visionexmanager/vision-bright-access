/**
 * useAmbientSound — continuous background ambient sounds via Web Audio API
 *
 * All sounds are synthesised (no audio files). Volume is intentionally very
 * low (≤ 0.04) so they are felt rather than heard. Fades in over 2 s and
 * out over 1.5 s. Fully respects the global sound‑enabled toggle.
 */

import { useEffect, useRef } from "react";
import { useSound } from "@/contexts/SoundContext";

export type AmbientType =
  | "marketplace" // VXBazaar — busy souk feel
  | "workshop"    // Repair / manufacturing simulations
  | "kitchen"     // Food / cooking simulations
  | "nature"      // Farm / outdoor simulations
  | "lab"         // Chemistry / lab simulations
  | "office"      // Logistics / business simulations
  | "focus";      // Learning / quiz — gentle binaural drift

// ── Shared AudioContext ───────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Noise buffer helpers ──────────────────────────────────────────────────────
function pinkNoiseBuffer(ctx: AudioContext, secs = 4): AudioBuffer {
  const n = ctx.sampleRate * secs;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
    b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
    b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

function whiteNoiseBuffer(ctx: AudioContext, secs = 3): AudioBuffer {
  const n = ctx.sampleRate * secs;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Ambient builders ──────────────────────────────────────────────────────────
// Each builder wires its nodes into `master` and returns a cleanup fn.

function buildMarketplace(ctx: AudioContext, master: GainNode): () => void {
  // Crowd murmur: pink noise → bandpass 200–700 Hz, slowly pulsing volume
  const src = ctx.createBufferSource();
  src.buffer = pinkNoiseBuffer(ctx, 5);
  src.loop = true;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.7;

  const ambGain = ctx.createGain(); ambGain.gain.value = 0.028;

  // LFO: 0.06 Hz — subtle crowd ebb & flow
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.007;
  lfo.connect(lfoGain); lfoGain.connect(ambGain.gain);

  src.connect(bp); bp.connect(ambGain); ambGain.connect(master);
  src.start(); lfo.start();

  // Occasional metallic coin clink every 9–18 s
  let timer: ReturnType<typeof setTimeout>;
  const clink = () => {
    timer = setTimeout(() => {
      try {
        const freq = 1800 + Math.random() * 1000;
        [freq, freq * 1.48].forEach((f, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "triangle"; o.frequency.value = f;
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.03);
          g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + i * 0.03 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.03 + 0.35);
          o.connect(g); g.connect(master);
          o.start(ctx.currentTime + i * 0.03);
          o.stop(ctx.currentTime + i * 0.03 + 0.36);
        });
      } catch { /**/ }
      clink();
    }, 9000 + Math.random() * 9000);
  };
  clink();

  return () => { clearTimeout(timer); try { src.stop(); lfo.stop(); } catch { /**/ } };
}

function buildWorkshop(ctx: AudioContext, master: GainNode): () => void {
  // Machine hum: sawtooth → lowpass 100 Hz
  const osc = ctx.createOscillator();
  osc.type = "sawtooth"; osc.frequency.value = 58;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 110;
  const g = ctx.createGain(); g.gain.value = 0.018;
  osc.connect(lp); lp.connect(g); g.connect(master); osc.start();

  // Air‑tool hiss: white noise → narrow bandpass 1800 Hz
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
  const nbp = ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.value = 1800; nbp.Q.value = 3;
  const ng = ctx.createGain(); ng.gain.value = 0.007;
  ns.connect(nbp); nbp.connect(ng); ng.connect(master); ns.start();

  return () => { try { osc.stop(); ns.stop(); } catch { /**/ } };
}

function buildKitchen(ctx: AudioContext, master: GainNode): () => void {
  // Sizzle: white noise → highpass 2800 Hz
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2800;
  const g = ctx.createGain(); g.gain.value = 0.01;
  ns.connect(hp); hp.connect(g); g.connect(master); ns.start();

  // Ventilation hum
  const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 76;
  const og = ctx.createGain(); og.gain.value = 0.014;
  osc.connect(og); og.connect(master); osc.start();

  return () => { try { ns.stop(); osc.stop(); } catch { /**/ } };
}

function buildNature(ctx: AudioContext, master: GainNode): () => void {
  // Wind: white noise → lowpass, slowly swept by LFO
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 4); ns.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;

  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
  const lfoG = ctx.createGain(); lfoG.gain.value = 280;
  lfo.connect(lfoG); lfoG.connect(lp.frequency);

  const g = ctx.createGain(); g.gain.value = 0.02;
  ns.connect(lp); lp.connect(g); g.connect(master);
  ns.start(); lfo.start();

  return () => { try { ns.stop(); lfo.stop(); } catch { /**/ } };
}

function buildLab(ctx: AudioContext, master: GainNode): () => void {
  // Equipment drone: two quiet sine harmonics
  [[72, 0.014], [144, 0.007]].forEach(([freq, vol]) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    o.connect(g); g.connect(master); o.start();
  });

  // Occasional soft beep every 12–22 s
  let timer: ReturnType<typeof setTimeout>;
  const beep = () => {
    timer = setTimeout(() => {
      try {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = 1050;
        g.gain.setValueAtTime(0.028, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.19);
      } catch { /**/ }
      beep();
    }, 12000 + Math.random() * 10000);
  };
  beep();

  // cleanup: we don't hold refs to the drone oscs so just clear timer
  return () => clearTimeout(timer);
}

function buildOffice(ctx: AudioContext, master: GainNode): () => void {
  // Air‑conditioning: white noise → strong lowpass 250 Hz
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 250;
  const g = ctx.createGain(); g.gain.value = 0.022;
  ns.connect(lp); lp.connect(g); g.connect(master); ns.start();
  return () => { try { ns.stop(); } catch { /**/ } };
}

function buildFocus(ctx: AudioContext, master: GainNode): () => void {
  // Gentle 8 Hz binaural‑style beat: two close sines
  const base = 196;
  [base, base + 8].forEach((freq, i) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0.013;
    // Pan slightly for stereo effect if supported
    try {
      const pan = ctx.createStereoPanner();
      pan.pan.value = i === 0 ? -0.4 : 0.4;
      o.connect(g); g.connect(pan); pan.connect(master);
    } catch {
      o.connect(g); g.connect(master);
    }
    o.start();
  });
  return () => { /* oscs will GC when master disconnects */ };
}

const BUILDERS: Record<AmbientType, (ctx: AudioContext, master: GainNode) => () => void> = {
  marketplace: buildMarketplace,
  workshop:    buildWorkshop,
  kitchen:     buildKitchen,
  nature:      buildNature,
  lab:         buildLab,
  office:      buildOffice,
  focus:       buildFocus,
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAmbientSound(type: AmbientType | null) {
  const { enabled } = useSound();
  const masterRef = useRef<GainNode | null>(null);
  const stopRef   = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!type || !enabled) return;

    let active = true;
    try {
      const ctx     = getCtx();
      const master  = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.connect(ctx.destination);
      masterRef.current = master;

      const stopFn = BUILDERS[type](ctx, master);
      stopRef.current = stopFn;

      if (active) {
        // Fade in over 2 s
        master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
      }
    } catch { /**/ }

    return () => {
      active = false;
      const master = masterRef.current;
      const stopFn = stopRef.current;
      masterRef.current = null;
      stopRef.current   = null;

      if (master && _ctx) {
        const ctx = _ctx;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        setTimeout(() => {
          stopFn?.();
          try { master.disconnect(); } catch { /**/ }
        }, 1600);
      }
    };
  }, [type, enabled]);
}

// ── Simulation slug → ambient type ────────────────────────────────────────────
export function getSimulationAmbient(slug = ""): AmbientType {
  const s = slug.toLowerCase();
  if (/kitchen|cook|chef|chocolate|food|bakery|restaurant|global-kitchen/.test(s)) return "kitchen";
  if (/farm|cattle|dairy|poultry|sheep|nature|animal|incubator/.test(s))           return "nature";
  if (/lab|perfume|detergent|skincare|chemistry|pharma|board-surgeon/.test(s))     return "lab";
  if (/repair|workshop|woodwork|hvac|aluminum|glazing|mobile|laptop/.test(s))      return "workshop";
  if (/logistic|office|noc|network|trade|business|tycoon|barber/.test(s))          return "office";
  if (/music|english|journey|academy|learn|language|solar/.test(s))               return "focus";
  return "focus";
}
