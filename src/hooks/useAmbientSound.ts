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
  | "marketplace"  // VXBazaar — busy souk feel
  | "workshop"     // Repair / light-manufacturing simulations
  | "kitchen"      // Food / cooking simulations
  | "nature"       // Generic outdoor
  | "lab"          // Chemistry / lab simulations
  | "office"       // Logistics / business simulations
  | "focus"        // Learning / quiz — gentle binaural drift
  | "farm"         // Agricultural / livestock simulations
  | "surgical"     // Hospital / operating room
  | "salon"        // Barbershop / beauty salon
  | "construction" // Heavy workshop, HVAC, glazing, woodworking
  | "datacenter";  // Network NOC / server room

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

// ── Farm: wind + periodic bird chirps + distant animal calls ─────────────────
function buildFarm(ctx: AudioContext, master: GainNode): () => void {
  // Soft wind: white noise → lowpass 500 Hz
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 4); ns.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = 180;
  lfo.connect(lfoG); lfoG.connect(lp.frequency);
  const g = ctx.createGain(); g.gain.value = 0.015;
  ns.connect(lp); lp.connect(g); g.connect(master);
  ns.start(); lfo.start();

  // Periodic bird chirp every 6–14 s
  const timers: ReturnType<typeof setTimeout>[] = [];
  const chirp = () => {
    const t = setTimeout(() => {
      try {
        const freq = 2200 + Math.random() * 1000;
        [0, 0.07, 0.14].forEach((delay) => {
          const o = ctx.createOscillator(); const gn = ctx.createGain();
          o.type = "triangle"; o.frequency.value = freq + delay * 600;
          gn.gain.setValueAtTime(0.022, ctx.currentTime + delay);
          gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.09);
          o.connect(gn); gn.connect(master);
          o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.1);
        });
      } catch { /**/ }
      chirp();
    }, 6000 + Math.random() * 8000);
    timers.push(t);
  };
  chirp();

  // Distant low animal call every 18–35 s
  const moo = () => {
    const t = setTimeout(() => {
      try {
        const ns2 = ctx.createBufferSource(); ns2.buffer = whiteNoiseBuffer(ctx, 0.5);
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 140; bp.Q.value = 5;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0, ctx.currentTime);
        gn.gain.linearRampToValueAtTime(0.018, ctx.currentTime + 0.1);
        gn.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 0.3);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        ns2.connect(bp); bp.connect(gn); gn.connect(master);
        ns2.start(); ns2.stop(ctx.currentTime + 0.7);
      } catch { /**/ }
      moo();
    }, 18000 + Math.random() * 17000);
    timers.push(t);
  };
  moo();

  return () => { timers.forEach(clearTimeout); try { ns.stop(); lfo.stop(); } catch { /**/ } };
}

// ── Surgical: slow ventilator rhythm + steady ECG beep + AC hum ─────────────
function buildSurgical(ctx: AudioContext, master: GainNode): () => void {
  // AC hum
  const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 62;
  const g = ctx.createGain(); g.gain.value = 0.01;
  osc.connect(g); g.connect(master); osc.start();

  // Ventilator: filtered noise pulsed at 0.25 Hz (one breath every 4 s)
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 320; bp.Q.value = 1.2;
  const vGain = ctx.createGain(); vGain.gain.value = 0;
  const vlfo = ctx.createOscillator(); vlfo.type = "sine"; vlfo.frequency.value = 0.25;
  const vlfoG = ctx.createGain(); vlfoG.gain.value = 0.009;
  vlfo.connect(vlfoG); vlfoG.connect(vGain.gain);
  ns.connect(bp); bp.connect(vGain); vGain.connect(master);
  ns.start(); vlfo.start();

  // ECG beep every 1 s
  const timers: ReturnType<typeof setTimeout>[] = [];
  const beat = () => {
    const t = setTimeout(() => {
      try {
        const o = ctx.createOscillator(); const gn = ctx.createGain();
        o.type = "sine"; o.frequency.value = 880;
        gn.gain.setValueAtTime(0.025, ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        o.connect(gn); gn.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.09);
      } catch { /**/ }
      beat();
    }, 1000);
    timers.push(t);
  };
  beat();

  return () => { timers.forEach(clearTimeout); try { osc.stop(); ns.stop(); vlfo.stop(); } catch { /**/ } };
}

// ── Salon: murmur + periodic scissors snip + soft background hum ────────────
function buildSalon(ctx: AudioContext, master: GainNode): () => void {
  // Conversation murmur: pink noise → bandpass 280–700 Hz
  const ns = ctx.createBufferSource(); ns.buffer = pinkNoiseBuffer(ctx, 5); ns.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.6;
  const lfoS = ctx.createOscillator(); lfoS.frequency.value = 0.05;
  const lfoSG = ctx.createGain(); lfoSG.gain.value = 0.006;
  lfoS.connect(lfoSG);
  const g = ctx.createGain(); g.gain.value = 0.018;
  lfoSG.connect(g.gain);
  ns.connect(bp); bp.connect(g); g.connect(master);
  ns.start(); lfoS.start();

  // Soft background hum (music-like two harmonics)
  [[220, 0.006], [330, 0.004]].forEach(([freq, vol]) => {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
    const gn = ctx.createGain(); gn.gain.value = vol;
    o.connect(gn); gn.connect(master); o.start();
  });

  // Scissors snip every 4–10 s
  const timers: ReturnType<typeof setTimeout>[] = [];
  const snip = () => {
    const t = setTimeout(() => {
      try {
        [0, 0.05].forEach((delay) => {
          const o = ctx.createOscillator(); const gn = ctx.createGain();
          o.type = "square"; o.frequency.value = 2400 + delay * 4000;
          gn.gain.setValueAtTime(0.018, ctx.currentTime + delay);
          gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.04);
          o.connect(gn); gn.connect(master);
          o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.05);
        });
      } catch { /**/ }
      snip();
    }, 4000 + Math.random() * 6000);
    timers.push(t);
  };
  snip();

  return () => { timers.forEach(clearTimeout); try { ns.stop(); lfoS.stop(); } catch { /**/ } };
}

// ── Construction: heavy tool hum + impact thuds + metal ring ────────────────
function buildConstruction(ctx: AudioContext, master: GainNode): () => void {
  // Heavy machinery hum: sawtooth → lowpass 90 Hz
  const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 48;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 90;
  const g = ctx.createGain(); g.gain.value = 0.022;
  osc.connect(lp); lp.connect(g); g.connect(master); osc.start();

  // Air tool hiss: white noise → narrow bandpass 1600 Hz
  const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1600; bp.Q.value = 4;
  const ng = ctx.createGain(); ng.gain.value = 0.009;
  ns.connect(bp); bp.connect(ng); ng.connect(master); ns.start();

  const timers: ReturnType<typeof setTimeout>[] = [];

  // Impact thud every 5–12 s
  const thud = () => {
    const t = setTimeout(() => {
      try {
        const o = ctx.createOscillator(); const gn = ctx.createGain();
        o.type = "sine"; o.frequency.value = 70;
        gn.gain.setValueAtTime(0.03, ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        o.connect(gn); gn.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.26);
      } catch { /**/ }
      thud();
    }, 5000 + Math.random() * 7000);
    timers.push(t);
  };
  thud();

  // Metal ring every 8–18 s
  const ring = () => {
    const t = setTimeout(() => {
      try {
        const o = ctx.createOscillator(); const gn = ctx.createGain();
        o.type = "triangle"; o.frequency.value = 1400 + Math.random() * 400;
        gn.gain.setValueAtTime(0.02, ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.connect(gn); gn.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.51);
      } catch { /**/ }
      ring();
    }, 8000 + Math.random() * 10000);
    timers.push(t);
  };
  ring();

  return () => { timers.forEach(clearTimeout); try { osc.stop(); ns.stop(); } catch { /**/ } };
}

// ── Data Center: multi-band server fans + disk activity + HVAC ─────────────
function buildDatacenter(ctx: AudioContext, master: GainNode): () => void {
  // Multi-band fan noise: three noise streams at different frequencies
  const bands = [{ freq: 800, q: 2, vol: 0.014 }, { freq: 1800, q: 3, vol: 0.009 }, { freq: 3200, q: 2, vol: 0.005 }];
  const sources: AudioBufferSourceNode[] = [];
  bands.forEach(({ freq, q, vol }) => {
    const ns = ctx.createBufferSource(); ns.buffer = whiteNoiseBuffer(ctx, 3); ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    ns.connect(bp); bp.connect(g); g.connect(master);
    ns.start(); sources.push(ns);
  });

  // HVAC low rumble
  const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = 55;
  const og = ctx.createGain(); og.gain.value = 0.012;
  osc.connect(og); og.connect(master); osc.start();

  // Disk activity click every 5–15 s
  const timers: ReturnType<typeof setTimeout>[] = [];
  const click = () => {
    const t = setTimeout(() => {
      try {
        const o = ctx.createOscillator(); const gn = ctx.createGain();
        o.type = "square"; o.frequency.value = 900;
        gn.gain.setValueAtTime(0.015, ctx.currentTime);
        gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
        o.connect(gn); gn.connect(master);
        o.start(); o.stop(ctx.currentTime + 0.04);
      } catch { /**/ }
      click();
    }, 5000 + Math.random() * 10000);
    timers.push(t);
  };
  click();

  return () => { timers.forEach(clearTimeout); sources.forEach(s => { try { s.stop(); } catch { /**/ } }); try { osc.stop(); } catch { /**/ } };
}

const BUILDERS: Record<AmbientType, (ctx: AudioContext, master: GainNode) => () => void> = {
  marketplace:  buildMarketplace,
  workshop:     buildWorkshop,
  kitchen:      buildKitchen,
  nature:       buildNature,
  lab:          buildLab,
  office:       buildOffice,
  focus:        buildFocus,
  farm:         buildFarm,
  surgical:     buildSurgical,
  salon:        buildSalon,
  construction: buildConstruction,
  datacenter:   buildDatacenter,
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
const SLUG_MAP: Record<string, AmbientType> = {
  // Agricultural / livestock
  "egg-incubator":    "farm",
  "dairy-farm":       "farm",
  "poultry-farm":     "farm",
  "sheep-farm":       "farm",
  "cattle-dairy":     "farm",
  // Food & beverage
  "chocolate-factory": "kitchen",
  "global-kitchen":    "kitchen",
  // Lab / chemistry / cosmetics
  "perfume-lab":    "lab",
  "detergent-lab":  "lab",
  "skin-care-lab":  "lab",
  // Healthcare
  "board-surgeon": "surgical",
  // Barbershop / salon
  "barber-salon": "salon",
  // Heavy workshop / construction / engineering
  "woodworking":      "construction",
  "hvac-systems":     "construction",
  "aluminum-glazing": "construction",
  "solar-energy":     "construction",
  // Light electronics repair
  "mobile-repair": "workshop",
  "laptop-repair": "workshop",
  // Data center / IT
  "network-noc": "datacenter",
  // Logistics / supply chain
  "logistics-supply": "office",
  // Business / trading
  "trade-tycoon": "office",
  // Learning / education
  "english-journey": "focus",
  "music-training":  "focus",
};

export function getSimulationAmbient(slug = ""): AmbientType {
  return SLUG_MAP[slug] ?? "focus";
}
