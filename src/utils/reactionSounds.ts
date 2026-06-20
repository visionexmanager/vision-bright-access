/**
 * Visionex Reaction Audio Engine v3
 *
 * Complete rebuild using acoustic-physics synthesis.
 * Target: indistinguishable from real human recordings.
 *
 * Key upgrades over v2:
 *  • Multi-clapper crowd applause (10-16 independent hands)
 *  • Multi-voice formant laugh with breath layers
 *  • Organic cardiac heartbeat with natural harmonics
 *  • Three-band turbulent fire with realistic crackle
 *  • Large-room crowd celebration with whistle/pop
 *  • No two reactions ever sound identical (full stochastic variation)
 *  • Shared reverb bus (not recreated per reaction)
 *  • Voice ducking API (setVoiceSpeakingState)
 *
 * Exports:
 *   playReactionSound(emoji)         – main entry, unchanged API
 *   setVoiceSpeakingState(active)    – feed speaking detection for ducking
 *   preloadReactionSounds()          – warm up AudioContext on room join
 *   disposeReactionSounds()          – release all resources on room leave
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MASTER_LVL   = 0.74;    // overall output level
const DUCK_TARGET  = 0.20;    // fraction of master while someone speaks
const DUCK_RAMP    = 0.18;    // seconds to ramp down
const UNDUCK_RAMP  = 0.70;    // seconds to recover
const REVERB_WET   = 0.19;    // reverb return level
const MIN_GAP_MS   = 28;      // anti-spam gate

// ─── Singleton State ──────────────────────────────────────────────────────────

let _ctx:        AudioContext  | null = null;
let _master:     GainNode      | null = null;
let _reverbSend: GainNode      | null = null;
let _lastPlay    = 0;
let _isDucking   = false;

// ─── Context & Graph ─────────────────────────────────────────────────────────

function acquireCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new Ctor({ latencyHint: "interactive", sampleRate: 44100 });
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    if (!_master) _buildGraph(_ctx);
    return _ctx;
  } catch {
    return null;
  }
}

function _buildGraph(ac: AudioContext): void {
  // Master gain (controlled by ducking)
  _master = ac.createGain();
  _master.gain.value = MASTER_LVL;

  // Shared reverb bus
  const reverb = ac.createConvolver();
  reverb.buffer = _buildRoomIR(ac, "medium");

  const reverbReturn = ac.createGain();
  reverbReturn.gain.value = REVERB_WET;

  _reverbSend = ac.createGain();
  _reverbSend.gain.value = 1;

  _reverbSend.connect(reverb);
  reverb.connect(reverbReturn);
  reverbReturn.connect(_master);
  _master.connect(ac.destination);
}

/** Procedural room impulse response — exponential noise + early reflections. */
function _buildRoomIR(
  ac: AudioContext,
  size: "small" | "medium" | "large"
): AudioBuffer {
  const SIZES = { small: 0.55, medium: 1.1, large: 2.2 };
  const DECAYS = { small: 5.8, medium: 4.2, large: 2.6 };
  const ER_MS = {
    small:  [6, 11, 18, 26],
    medium: [10, 17, 26, 37, 51, 68],
    large:  [15, 27, 42, 60, 80, 104, 132],
  };

  const dur  = SIZES[size] * (0.85 + Math.random() * 0.3);
  const dec  = DECAYS[size];
  const sr   = ac.sampleRate;
  const len  = Math.ceil(sr * dur);
  const buf  = ac.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-dec * (i / sr));
    }
    ER_MS[size].forEach((ms, k) => {
      const si = Math.floor(ms * 0.001 * sr);
      if (si < len) {
        const mag = (1 - k * 0.13) * (ch === 0 ? 1 : 0.82 + Math.random() * 0.25);
        d[si] += (Math.random() > 0.5 ? 1 : -1) * mag * 2.0;
      }
    });
  }
  return buf;
}

// ─── Ducking ──────────────────────────────────────────────────────────────────

export function setVoiceSpeakingState(speaking: boolean): void {
  if (!_master || !_ctx) return;
  const t = _ctx.currentTime;
  if (speaking && !_isDucking) {
    _isDucking = true;
    _master.gain.cancelScheduledValues(t);
    _master.gain.setValueAtTime(_master.gain.value, t);
    _master.gain.linearRampToValueAtTime(MASTER_LVL * DUCK_TARGET, t + DUCK_RAMP);
  } else if (!speaking && _isDucking) {
    _isDucking = false;
    _master.gain.cancelScheduledValues(t);
    _master.gain.setValueAtTime(_master.gain.value, t);
    _master.gain.linearRampToValueAtTime(MASTER_LVL, t + UNDUCK_RAMP);
  }
}

// ─── Low-level Utilities ──────────────────────────────────────────────────────

/** Random float in [lo, hi) */
const R = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** Create a GainNode with initial value */
function G(ac: AudioContext, v: number): GainNode {
  const g = ac.createGain();
  g.gain.value = v;
  return g;
}

/** Create a BiquadFilterNode */
function F(
  ac: AudioContext,
  type: BiquadFilterType,
  freq: number,
  q = 1.0
): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** Create a StereoPannerNode */
function P(ac: AudioContext, pan: number): StereoPannerNode {
  const p = ac.createStereoPanner();
  p.pan.value = pan;
  return p;
}

/** White noise AudioBufferSourceNode */
function whiteNoise(ac: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Pink noise AudioBufferSourceNode (Kellet's algorithm) */
function pinkNoise(ac: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

/** Send `src` to both master and reverb bus */
function toMix(src: AudioNode, sendReverb = true): void {
  if (_master) src.connect(_master);
  if (sendReverb && _reverbSend) src.connect(_reverbSend);
}

/** Connect chain: a→b→c→... */
function chain(...nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

// ─── Synthesis: APPLAUSE ─────────────────────────────────────────────────────
// Multi-clapper crowd simulation — 10-16 independent hands.

function synthApplause(ac: AudioContext, t0: number): void {
  const busGain = G(ac, R(0.50, 0.68));
  toMix(busGain, true);

  const numClappers = Math.floor(R(10, 17));
  for (let i = 0; i < numClappers; i++) {
    const delay = R(0, 0.115);
    _scheduleClap(ac, busGain, t0 + delay);
  }

  // Optional second burst (applause wave)
  if (Math.random() > 0.45) {
    const waveDelay = R(0.22, 0.48);
    const waveCount = Math.floor(R(4, 9));
    for (let i = 0; i < waveCount; i++) {
      _scheduleClap(ac, busGain, t0 + waveDelay + R(0, 0.09));
    }
  }
}

function _scheduleClap(ac: AudioContext, out: GainNode, t: number): void {
  const dur   = R(0.042, 0.082);
  const pan   = R(-0.88, 0.88);
  const level = R(0.28, 0.68);

  const panNode = P(ac, pan);
  const lvlGain = G(ac, level);
  chain(lvlGain, panNode);
  panNode.connect(out);

  // Path 1 — body of clap (mid frequencies)
  {
    const n  = whiteNoise(ac, dur + 0.04);
    const hp = F(ac, "highpass", R(620, 900));
    const bp = F(ac, "bandpass", R(900, 2800), R(0.7, 1.9));
    const e  = G(ac, 0);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(1.0, t + 0.0018);
    e.gain.exponentialRampToValueAtTime(0.001, t + dur);
    chain(n, hp, bp, e, lvlGain);
    n.start(t); n.stop(t + dur + 0.04);
  }

  // Path 2 — high snap / transient
  {
    const snapDur = dur * 0.38;
    const n  = whiteNoise(ac, snapDur + 0.02);
    const bp = F(ac, "bandpass", R(2200, 4800), R(0.5, 1.1));
    const sg = G(ac, 0.55);
    const e  = G(ac, 0);
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(1.0, t + 0.0008);
    e.gain.exponentialRampToValueAtTime(0.001, t + snapDur);
    chain(n, bp, e, sg, lvlGain);
    n.start(t); n.stop(t + snapDur + 0.02);
  }
}

// ─── Synthesis: LAUGH ────────────────────────────────────────────────────────
// Multi-voice formant laugh with breath between bursts.

function synthLaugh(ac: AudioContext, t0: number): void {
  const numVoices = Math.floor(R(2, 4));
  const numBursts = Math.floor(R(3, 6));
  const burstGap  = R(0.185, 0.300);

  for (let v = 0; v < numVoices; v++) {
    const pitch   = R(135, 290);          // male 130-175 | female 180-290
    const pan     = R(-0.55, 0.55);
    const level   = R(0.28, 0.62);
    const vDelay  = v * R(0.008, 0.038); // slight stagger per voice

    const panNode = P(ac, pan);
    toMix(panNode, true);

    for (let b = 0; b < numBursts; b++) {
      const bt  = t0 + vDelay + b * burstGap + R(-0.022, 0.022);
      const dur = R(0.09, 0.20);
      _scheduleLaughBurst(ac, panNode, bt, dur, pitch * (1 + R(-0.07, 0.07)), level);

      // Aspirated breath between ha-bursts
      if (b < numBursts - 1) {
        _scheduleBreath(ac, panNode, bt + dur, R(0.04, 0.10), level * 0.18);
      }
    }
  }
}

function _scheduleLaughBurst(
  ac: AudioContext, out: AudioNode,
  t: number, dur: number, pitch: number, level: number
): void {
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  // Natural laugh intonation: slight pitch rise then fall
  osc.frequency.setValueAtTime(pitch * 1.08, t);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.93, t + dur * 0.65);

  // Formant filters for open "ah" vowel
  const f1 = F(ac, "bandpass", R(710, 850), R(5.5, 9.0));
  const f2 = F(ac, "bandpass", R(1060, 1280), R(4.0, 7.0));
  const f3 = F(ac, "bandpass", R(2280, 2720), R(2.5, 4.5));

  const g1 = G(ac, 0.80); const g2 = G(ac, 0.55); const g3 = G(ac, 0.32);
  const mix = G(ac, 1.0);
  const env = G(ac, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(level, t + 0.022);
  env.gain.setValueAtTime(level, t + dur * 0.38);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);

  osc.connect(f1); f1.connect(g1); g1.connect(mix);
  osc.connect(f2); f2.connect(g2); g2.connect(mix);
  osc.connect(f3); f3.connect(g3); g3.connect(mix);
  chain(mix, env, out);

  osc.start(t); osc.stop(t + dur + 0.03);
}

function _scheduleBreath(
  ac: AudioContext, out: AudioNode,
  t: number, dur: number, level: number
): void {
  const n  = whiteNoise(ac, dur + 0.01);
  const hp = F(ac, "highpass", R(1800, 3500));
  const lp = F(ac, "lowpass",  R(6000, 10000));
  const e  = G(ac, 0);
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(level, t + dur * 0.35);
  e.gain.exponentialRampToValueAtTime(0.001, t + dur);
  chain(n, hp, lp, e, out);
  n.start(t); n.stop(t + dur + 0.01);
}

// ─── Synthesis: HEARTBEAT ────────────────────────────────────────────────────
// Organic lub-dub with natural harmonics and room presence.

function synthHeartbeat(ac: AudioContext, t0: number): void {
  const bus = G(ac, 1.0);
  toMix(bus, false); // heartbeat sounds intimate — no reverb

  const beatPan = R(-0.12, 0.12);

  // Lub (S1 — mitral/tricuspid close)
  _scheduleThump(ac, bus, t0, R(88, 105), R(41, 54), R(0.21, 0.27), 0.88, beatPan);

  // Dub (S2 — aortic/pulmonic close) — slightly higher pitch, shorter
  const dubOffset = R(0.14, 0.19);
  _scheduleThump(ac, bus, t0 + dubOffset, R(102, 120), R(55, 68), R(0.14, 0.19), 0.64, beatPan);

  // Subtle pink noise floor — presence of a real room
  const ambDur = 0.85;
  const amb = pinkNoise(ac, ambDur);
  const ambLp = F(ac, "lowpass", 180);
  const ambE  = G(ac, 0);
  ambE.gain.setValueAtTime(0, t0);
  ambE.gain.linearRampToValueAtTime(0.018, t0 + 0.12);
  ambE.gain.setValueAtTime(0.018, t0 + 0.55);
  ambE.gain.linearRampToValueAtTime(0, t0 + ambDur);
  chain(amb, ambLp, ambE, bus);
  amb.start(t0); amb.stop(t0 + ambDur);
}

function _scheduleThump(
  ac: AudioContext, out: GainNode,
  t: number, fStart: number, fEnd: number,
  dur: number, level: number, pan: number
): void {
  const panNode = P(ac, pan);
  panNode.connect(out);

  // Primary sine sweep — the deep thump
  const osc  = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fStart, t);
  osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur * 0.62);
  const lp  = F(ac, "lowpass", R(115, 140), R(0.7, 1.2));
  const env = G(ac, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(level, t + 0.0038);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  chain(osc, lp, env, panNode);
  osc.start(t); osc.stop(t + dur + 0.02);

  // Natural harmonic (×1.82 — adds organic chest resonance)
  const osc2  = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(fStart * 1.82, t);
  osc2.frequency.exponentialRampToValueAtTime(fEnd * 1.78, t + dur * 0.48);
  const lp2  = F(ac, "lowpass", R(230, 280));
  const env2 = G(ac, 0);
  env2.gain.setValueAtTime(0, t);
  env2.gain.linearRampToValueAtTime(level * 0.28, t + 0.003);
  env2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.58);
  chain(osc2, lp2, env2, panNode);
  osc2.start(t); osc2.stop(t + dur * 0.6 + 0.02);
}

// ─── Synthesis: FIRE ─────────────────────────────────────────────────────────
// Three-band turbulent combustion with natural crackle and flame modulation.

function synthFire(ac: AudioContext, t0: number): void {
  const dur = R(0.70, 1.05);
  const bus = G(ac, R(0.55, 0.72));
  toMix(bus, true);

  // Band 1 — low rumble (turbulent air, 40-180 Hz)
  {
    const n   = pinkNoise(ac, dur);
    const lp  = F(ac, "lowpass", R(150, 190));
    // Flame flicker LFO (5-9 Hz)
    const lfo = ac.createOscillator();
    lfo.frequency.value = R(5, 9);
    const lfoG = G(ac, R(0.28, 0.42));
    const bias = G(ac, 0.62);
    const env  = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.30, 0.45), t0 + 0.06);
    env.gain.setValueAtTime(R(0.28, 0.44), t0 + dur * 0.75);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    lfo.connect(lfoG); lfoG.connect(bias.gain);   // LFO modulates gain
    chain(n, lp, env);
    env.connect(bias); bias.connect(bus);
    lfo.start(t0); lfo.stop(t0 + dur);
    n.start(t0); n.stop(t0 + dur);
  }

  // Band 2 — mid crackle (combustion turbulence, 200-700 Hz)
  {
    const n    = whiteNoise(ac, dur);
    const bp   = F(ac, "bandpass", R(280, 680), R(0.6, 1.2));
    const lfo2 = ac.createOscillator();
    lfo2.frequency.value = R(11, 18);
    const lg2  = G(ac, R(0.32, 0.50));
    const bias2 = G(ac, 0.55);
    const env2  = G(ac, 0);
    env2.gain.setValueAtTime(0, t0);
    env2.gain.linearRampToValueAtTime(R(0.20, 0.32), t0 + 0.04);
    env2.gain.setValueAtTime(R(0.18, 0.30), t0 + dur * 0.80);
    env2.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    lfo2.connect(lg2); lg2.connect(bias2.gain);
    chain(n, bp, env2);
    env2.connect(bias2); bias2.connect(bus);
    lfo2.start(t0); lfo2.stop(t0 + dur);
    n.start(t0); n.stop(t0 + dur);
  }

  // Band 3 — high hiss + micro-crackles (3kHz+)
  {
    const n   = whiteNoise(ac, dur);
    const hp  = F(ac, "highpass", R(3200, 4800));
    const lfo3 = ac.createOscillator();
    lfo3.frequency.value = R(16, 24);
    const lg3  = G(ac, R(0.22, 0.38));
    const bias3 = G(ac, 0.42);
    const env3  = G(ac, 0);
    env3.gain.setValueAtTime(0, t0);
    env3.gain.linearRampToValueAtTime(R(0.12, 0.20), t0 + 0.02);
    env3.gain.setValueAtTime(R(0.10, 0.18), t0 + dur * 0.85);
    env3.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    lfo3.connect(lg3); lg3.connect(bias3.gain);
    chain(n, hp, env3);
    env3.connect(bias3); bias3.connect(bus);
    lfo3.start(t0); lfo3.stop(t0 + dur);
    n.start(t0); n.stop(t0 + dur);
  }

  // Occasional sharp pops (ignition micro-events)
  const numPops = Math.floor(R(3, 7));
  for (let i = 0; i < numPops; i++) {
    const pt  = t0 + R(0.05, dur * 0.85);
    const n   = whiteNoise(ac, 0.018);
    const hp  = F(ac, "highpass", R(2800, 6000));
    const e   = G(ac, 0);
    e.gain.setValueAtTime(0, pt);
    e.gain.linearRampToValueAtTime(R(0.25, 0.55), pt + 0.0005);
    e.gain.exponentialRampToValueAtTime(0.001, pt + 0.018);
    chain(n, hp, e, bus);
    n.start(pt); n.stop(pt + 0.02);
  }
}

// ─── Synthesis: CELEBRATION ──────────────────────────────────────────────────
// Crowd cheer + cork pop + applause + optional whistle.

function synthCelebration(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.60, 0.78));
  toMix(bus, true);

  // Cork pop / confetti burst — sharp broadband transient
  {
    const n  = whiteNoise(ac, 0.025);
    const hp = F(ac, "highpass", R(2500, 4000));
    const e  = G(ac, 0);
    e.gain.setValueAtTime(0, t0);
    e.gain.linearRampToValueAtTime(R(0.55, 0.80), t0 + 0.0005);
    e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.025);
    chain(n, hp, e, bus);
    n.start(t0); n.stop(t0 + 0.03);
  }

  // Crowd cheer — 3-5 voiced formant layers
  const numLayers = Math.floor(R(3, 5));
  for (let i = 0; i < numLayers; i++) {
    const pitch   = R(120, 300);
    const pan     = R(-0.75, 0.75);
    const level   = R(0.18, 0.45);
    const delay   = R(0.01, 0.06);
    const cheeDur = R(0.45, 0.75);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    // Rising cheer pitch
    osc.frequency.setValueAtTime(pitch, t0 + delay);
    osc.frequency.linearRampToValueAtTime(pitch * R(1.15, 1.40), t0 + delay + cheeDur * 0.6);

    const f1 = F(ac, "bandpass", R(500, 750), R(4, 8));
    const f2 = F(ac, "bandpass", R(1000, 1500), R(3, 6));
    const f3 = F(ac, "bandpass", R(2200, 3200), R(2, 4));
    const g1 = G(ac, 0.8); const g2 = G(ac, 0.5); const g3 = G(ac, 0.28);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(level, t0 + delay + 0.06);
    env.gain.setValueAtTime(level, t0 + delay + cheeDur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + cheeDur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    osc.connect(f3); f3.connect(g3); g3.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + cheeDur + 0.04);
  }

  // Mini-applause layer
  const appCount = Math.floor(R(5, 9));
  for (let i = 0; i < appCount; i++) {
    _scheduleClap(ac, bus, t0 + R(0.04, 0.20));
  }

  // Whistle (50% chance)
  if (Math.random() > 0.5) {
    const wt  = t0 + R(0.08, 0.18);
    const wDur = R(0.28, 0.48);
    const wf  = R(2400, 3400);
    const osc = ac.createOscillator();
    osc.type = "sine";
    // Whistle vibrato via FM
    const vibOsc = ac.createOscillator();
    vibOsc.frequency.value = R(5, 8);
    const vibG = G(ac, wf * 0.022);
    osc.frequency.value = wf;
    vibOsc.connect(vibG); vibG.connect(osc.frequency);
    const env = G(ac, 0);
    const pn  = P(ac, R(-0.3, 0.3));
    env.gain.setValueAtTime(0, wt);
    env.gain.linearRampToValueAtTime(R(0.10, 0.18), wt + 0.025);
    env.gain.setValueAtTime(R(0.09, 0.16), wt + wDur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.001, wt + wDur);
    chain(osc, env, pn, bus);
    osc.start(wt); osc.stop(wt + wDur + 0.04);
    vibOsc.start(wt); vibOsc.stop(wt + wDur + 0.04);
  }
}

// ─── Synthesis: SURPRISE ─────────────────────────────────────────────────────
// Breath intake + voiced "oh" gasp, 2-3 layered voices.

function synthSurprise(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.50, 0.68));
  toMix(bus, true);

  // Brief breath intake (aspirated h at start)
  {
    const n  = whiteNoise(ac, 0.075);
    const hp = F(ac, "highpass", R(1200, 2500));
    const e  = G(ac, 0);
    e.gain.setValueAtTime(0, t0);
    e.gain.linearRampToValueAtTime(R(0.12, 0.22), t0 + 0.025);
    e.gain.exponentialRampToValueAtTime(0.001, t0 + 0.075);
    chain(n, hp, e, bus);
    n.start(t0); n.stop(t0 + 0.08);
  }

  const numVoices = Math.floor(R(2, 4));
  for (let v = 0; v < numVoices; v++) {
    const pitch   = R(155, 310);
    const pan     = R(-0.60, 0.60);
    const level   = R(0.22, 0.52);
    const delay   = v * R(0.01, 0.03);
    const dur     = R(0.28, 0.45);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    // Rising "oh" intonation
    osc.frequency.setValueAtTime(pitch * 0.88, t0 + delay);
    osc.frequency.linearRampToValueAtTime(pitch * 1.22, t0 + delay + dur * 0.55);
    osc.frequency.setValueAtTime(pitch * 1.22, t0 + delay + dur * 0.55);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.05, t0 + delay + dur);

    // Open "oh" vowel: F1=550-700, F2=850-1050 Hz
    const f1 = F(ac, "bandpass", R(540, 700), R(5, 8));
    const f2 = F(ac, "bandpass", R(840, 1060), R(3.5, 6));
    const g1 = G(ac, 0.85); const g2 = G(ac, 0.55);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(level, t0 + delay + 0.028);
    env.gain.setValueAtTime(level, t0 + delay + dur * 0.45);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.04);
  }
}

// ─── Synthesis: APPROVAL ─────────────────────────────────────────────────────
// Small group "yeah / nice / mm" — warm, close.

function synthApproval(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.42, 0.60));
  toMix(bus, false); // intimate — minimal reverb

  const numVoices = Math.floor(R(2, 4));
  for (let v = 0; v < numVoices; v++) {
    const pitch   = R(130, 270);
    const pan     = R(-0.55, 0.55);
    const level   = R(0.20, 0.48);
    const delay   = v * R(0.012, 0.045);
    const dur     = R(0.14, 0.26);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = pitch;
    osc.frequency.linearRampToValueAtTime(pitch * R(1.04, 1.12), t0 + delay + dur * 0.5);

    // "Yeah" — front vowel (F1=400-600, F2=1800-2200)
    const f1 = F(ac, "bandpass", R(390, 590), R(6, 9));
    const f2 = F(ac, "bandpass", R(1750, 2200), R(4, 7));
    const g1 = G(ac, 0.90); const g2 = G(ac, 0.50);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(level, t0 + delay + 0.018);
    env.gain.setValueAtTime(level, t0 + delay + dur * 0.42);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.03);
  }
}

// ─── Synthesis: THANKS ───────────────────────────────────────────────────────
// Warm "ahh" appreciation — gentle crowd murmur.

function synthThanks(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.38, 0.55));
  toMix(bus, true);

  const numVoices = Math.floor(R(2, 4));
  for (let v = 0; v < numVoices; v++) {
    const pitch = R(140, 280);
    const pan   = R(-0.65, 0.65);
    const level = R(0.18, 0.44);
    const delay = v * R(0.015, 0.05);
    const dur   = R(0.35, 0.60);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = pitch;
    osc.frequency.linearRampToValueAtTime(pitch * 0.88, t0 + delay + dur * 0.7);

    // Warm "ah" — low first formant, mid second
    const f1 = F(ac, "bandpass", R(680, 820), R(6, 9));
    const f2 = F(ac, "bandpass", R(1050, 1280), R(4, 7));
    const f3 = F(ac, "bandpass", R(2400, 2800), R(2, 3));
    const g1 = G(ac, 0.90); const g2 = G(ac, 0.55); const g3 = G(ac, 0.20);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(level, t0 + delay + 0.032);
    env.gain.setValueAtTime(level, t0 + delay + dur * 0.50);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    osc.connect(f3); f3.connect(g3); g3.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.04);
  }
}

// ─── Synthesis: SHIMMER (star, sparkle, crystal) ─────────────────────────────
// Detuned triangle tones — crystalline, not bell-like.

function synthShimmer(ac: AudioContext, t0: number, bright = false): void {
  const bus = G(ac, R(0.38, 0.54));
  toMix(bus, true);

  const baseFreq  = bright ? R(2200, 4200) : R(1400, 2800);
  const numTones  = Math.floor(R(4, 7));
  const intervals = [1, 1.26, 1.587, 2.0, 2.52, 3.17, 4.0].slice(0, numTones);

  intervals.forEach((ratio, i) => {
    const freq  = baseFreq * ratio;
    const det   = 1 + R(-0.008, 0.008); // subtle detuning
    const osc   = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq * det;
    const delay = i * R(0.018, 0.038);
    const dur   = R(0.25, 0.55);
    const env   = G(ac, 0);
    const pan   = P(ac, R(-0.6, 0.6));
    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(R(0.15, 0.38) / (i * 0.3 + 1), t0 + delay + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);
    chain(osc, env, pan, bus);
    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.04);
  });
}

// ─── Synthesis: WHOOSH / ROCKET ──────────────────────────────────────────────
// Multi-layer air turbulence — realistic launch noise.

function synthWhoosh(ac: AudioContext, t0: number): void {
  const dur = R(0.55, 0.80);
  const bus = G(ac, R(0.52, 0.68));
  toMix(bus, true);

  // Low rumble — engine thrust
  {
    const n   = pinkNoise(ac, dur);
    const lp  = F(ac, "lowpass", R(180, 280));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.35, 0.55), t0 + dur * 0.18);
    env.gain.setValueAtTime(R(0.32, 0.50), t0 + dur * 0.70);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    chain(n, lp, env, bus);
    n.start(t0); n.stop(t0 + dur);
  }

  // Mid turbulence — air stream
  {
    const n   = whiteNoise(ac, dur);
    const bp  = F(ac, "bandpass", R(400, 900), R(0.7, 1.4));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.22, 0.38), t0 + dur * 0.12);
    env.gain.setValueAtTime(R(0.20, 0.35), t0 + dur * 0.78);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    chain(n, bp, env, bus);
    n.start(t0); n.stop(t0 + dur);
  }

  // High hiss — rising air friction
  {
    const n   = whiteNoise(ac, dur);
    const hp  = F(ac, "highpass", R(2800, 4500));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.08, 0.16), t0 + dur * 0.25);
    env.gain.setValueAtTime(R(0.06, 0.14), t0 + dur * 0.85);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    chain(n, hp, env, bus);
    n.start(t0); n.stop(t0 + dur);
  }
}

// ─── Synthesis: ENERGY / LIGHTNING ───────────────────────────────────────────
// Sharp electrical crack + brief electric hum.

function synthEnergy(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.55, 0.72));
  toMix(bus, true);

  // Sharp crack — broadband transient
  {
    const n   = whiteNoise(ac, 0.035);
    const hp  = F(ac, "highpass", R(3800, 6000));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.65, 0.90), t0 + 0.0005);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.035);
    chain(n, hp, env, bus);
    n.start(t0); n.stop(t0 + 0.04);
  }

  // Electric buzz tail
  {
    const buzzDur = R(0.12, 0.22);
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = R(55, 68); // 60Hz hum region
    const lp  = F(ac, "lowpass", R(2200, 4000));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0 + 0.004);
    env.gain.linearRampToValueAtTime(R(0.08, 0.18), t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.004 + buzzDur);
    chain(osc, lp, env, bus);
    osc.start(t0 + 0.004); osc.stop(t0 + 0.004 + buzzDur + 0.02);
  }
}

// ─── Synthesis: SADNESS ──────────────────────────────────────────────────────
// Quiet, slow sigh — emotional but not theatrical.

function synthSad(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.32, 0.48));
  toMix(bus, false);

  // Slow breath out (sigh)
  {
    const n   = whiteNoise(ac, 0.65);
    const hp  = F(ac, "highpass", R(1400, 2800));
    const lp  = F(ac, "lowpass",  R(5000, 8000));
    const env = G(ac, 0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(R(0.14, 0.24), t0 + 0.20);
    env.gain.setValueAtTime(R(0.12, 0.22), t0 + 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.65);
    chain(n, hp, lp, env, bus);
    n.start(t0); n.stop(t0 + 0.68);
  }

  // Very faint descending vocal tone
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(R(200, 260), t0 + 0.08);
  osc.frequency.exponentialRampToValueAtTime(R(140, 180), t0 + 0.55);
  const f1  = F(ac, "bandpass", R(580, 700), R(5, 8));
  const f2  = F(ac, "bandpass", R(1050, 1300), R(3, 6));
  const g1  = G(ac, 0.80); const g2 = G(ac, 0.45);
  const mix = G(ac, 1.0);
  const env = G(ac, 0);
  env.gain.setValueAtTime(0, t0 + 0.06);
  env.gain.linearRampToValueAtTime(R(0.08, 0.15), t0 + 0.18);
  env.gain.setValueAtTime(R(0.06, 0.13), t0 + 0.42);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.60);
  osc.connect(f1); f1.connect(g1); g1.connect(mix);
  osc.connect(f2); f2.connect(g2); g2.connect(mix);
  chain(mix, env, bus);
  osc.start(t0 + 0.06); osc.stop(t0 + 0.64);
}

// ─── Synthesis: CROWD ─────────────────────────────────────────────────────────
// General crowd reaction — enthusiastic but brief.

function synthCrowd(ac: AudioContext, t0: number): void {
  // Reuse celebration minus the pop + whistle
  const bus = G(ac, R(0.48, 0.65));
  toMix(bus, true);

  const numLayers = Math.floor(R(2, 5));
  for (let i = 0; i < numLayers; i++) {
    const pitch  = R(130, 280);
    const pan    = R(-0.70, 0.70);
    const level  = R(0.20, 0.48);
    const delay  = i * R(0.012, 0.04);
    const dur    = R(0.32, 0.55);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(pitch, t0 + delay);
    osc.frequency.linearRampToValueAtTime(pitch * R(1.08, 1.25), t0 + delay + dur * 0.55);

    const f1 = F(ac, "bandpass", R(550, 800), R(4, 7));
    const f2 = F(ac, "bandpass", R(1100, 1800), R(3, 5));
    const g1 = G(ac, 0.85); const g2 = G(ac, 0.50);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(level, t0 + delay + 0.05);
    env.gain.setValueAtTime(level, t0 + delay + dur * 0.50);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.04);
  }
}

// ─── Synthesis: FANFARE ──────────────────────────────────────────────────────
// Triumphant multi-voiced ascending cheer.

function synthFanfare(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.55, 0.72));
  toMix(bus, true);

  // Rising crowd cheer
  synthCrowd(ac, t0);

  // Short rhythmic applause burst
  const appCount = Math.floor(R(3, 6));
  for (let i = 0; i < appCount; i++) {
    _scheduleClap(ac, bus, t0 + R(0.10, 0.35));
  }

  // Bright shimmer accent
  synthShimmer(ac, t0 + R(0.12, 0.22), true);
}

// ─── Synthesis: COOL ─────────────────────────────────────────────────────────
// Smooth impressed response — low-mid murmur with slight shimmer.

function synthCool(ac: AudioContext, t0: number): void {
  const bus = G(ac, R(0.40, 0.55));
  toMix(bus, true);

  // Low "mmm" — voiced bilabial
  const numVoices = Math.floor(R(1, 3));
  for (let v = 0; v < numVoices; v++) {
    const pitch = R(110, 200);
    const pan   = R(-0.45, 0.45);
    const dur   = R(0.28, 0.50);
    const delay = v * R(0.008, 0.030);

    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = pitch;
    osc.frequency.linearRampToValueAtTime(pitch * R(0.92, 1.05), t0 + delay + dur * 0.6);

    const f1 = F(ac, "bandpass", R(250, 380), R(7, 11)); // "mm" — very low F1
    const f2 = F(ac, "bandpass", R(900, 1200), R(4, 6));
    const g1 = G(ac, 0.90); const g2 = G(ac, 0.40);
    const mix = G(ac, 1.0);
    const env = G(ac, 0);
    const pn  = P(ac, pan);

    env.gain.setValueAtTime(0, t0 + delay);
    env.gain.linearRampToValueAtTime(R(0.20, 0.40), t0 + delay + 0.020);
    env.gain.setValueAtTime(R(0.18, 0.38), t0 + delay + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + delay + dur);

    osc.connect(f1); f1.connect(g1); g1.connect(mix);
    osc.connect(f2); f2.connect(g2); g2.connect(mix);
    chain(mix, env, pn, bus);

    osc.start(t0 + delay); osc.stop(t0 + delay + dur + 0.03);
  }

  // Subtle high shimmer accent
  if (Math.random() > 0.4) synthShimmer(ac, t0 + R(0.10, 0.20));
}

// ─── Emoji → Synthesis Category Map ──────────────────────────────────────────

const V = "️";  // variation selector
const Z = "‍";  // ZWJ

/** Strip skin-tone modifiers, variation selectors and ZWJ for lookup */
function clean(emoji: string): string {
  return Array.from(emoji)
    .filter((c) => { const cp = c.codePointAt(0) ?? 0; return cp < 0x1f3fb || cp > 0x1f3ff; })
    .join("")
    .replaceAll(V, "")
    .replaceAll(Z, "");
}

type SynthFn = (ac: AudioContext, t0: number) => void;

const MAP: Record<string, SynthFn> = {};

function reg(fn: SynthFn, ...emojis: string[]): void {
  emojis.forEach((e) => { MAP[e] = fn; });
}

// Applause
reg(synthApplause,
  "👏","🙌","🤲",
);

// Laugh
reg(synthLaugh,
  "😂","😆","😅","🤣","😁","😄","😃","🤪","😜","😝","🤭","😬",
);

// Heartbeat / Love
reg(synthHeartbeat,
  "❤️","🥰","😍","💕","💗","💓","💞","💖","💝","🫶","🫂","💑","❤",
);

// Fire / Explosion
reg(synthFire,
  "🔥","💥","🌋",
);

// Celebration
reg(synthCelebration,
  "🎉","🎊","🥳","🎈","🎁","🎆","🎇","🧨",
);

// Surprise / Shock
reg(synthSurprise,
  "😮","🤯","😳","🫣","😲","🫢","😱","🙀",
);

// Approval / Power
reg(synthApproval,
  "👍","👍🏼","👍🏽","👍🏾","👍🏿","💪","🤙","✌️","✌","👋","🙋",
  "🤜","🤛","🤞","👌","🤌","🫵",
);

// Thanks / Prayer
reg(synthThanks,
  "🙏","🫶",
);

// Star / Shimmer
reg((ac, t0) => synthShimmer(ac, t0, false),
  "⭐","🌟","💫","💡","🌈","☀️","🌙","✨","❄️","🍀","🌸","🌺","🌻","🦋",
);
reg((ac, t0) => synthShimmer(ac, t0, true),
  "💎","👑","🏅","🥈","🥉","💍",
);

// Success / Trophy
reg(synthCrowd,
  "💯","🏆","🥇","🎯","🎖️","🎖",
);

// Rocket / Whoosh
reg(synthWhoosh,
  "🚀","🛸","✈️","✈","🛩️","🛩","🌊","🏄",
);

// Lightning / Energy
reg(synthEnergy,
  "⚡","🌩️","🌩","🔋","⚡",
);

// Sadness
reg(synthSad,
  "😢","😭","🥺","😥","😞","😔","😟","💔","🥲",
);

// Cool / Impressed
reg(synthCool,
  "😎","🤩","🥸","😏","🤫","😌",
);

// Crowd cheer
reg(synthCrowd,
  "🎵","🎶","🎸","🎮","⚽","🏀","🎤","📣","📢",
);

// Fanfare
reg(synthFanfare,
  "🏳️","🚩","🎺","🥁","🎻",
);

/** Fallback sound for unmapped emojis */
function synthFallback(ac: AudioContext, t0: number, emoji: string): void {
  const hash = Array.from(emoji).reduce((s, c) => s + (c.codePointAt(0) ?? 0), 0);
  const mode = hash % 5;
  if (mode === 0) synthShimmer(ac, t0);
  else if (mode === 1) synthApproval(ac, t0);
  else if (mode === 2) synthCrowd(ac, t0);
  else if (mode === 3) synthEnergy(ac, t0);
  else synthCool(ac, t0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function playReactionSound(emoji: string): void {
  const now = Date.now();
  if (now - _lastPlay < MIN_GAP_MS) return;
  _lastPlay = now;

  try {
    const ac = acquireCtx();
    if (!ac) return;

    const t0  = ac.currentTime + 0.006;
    const key = clean(emoji);
    const fn  = MAP[key] ?? MAP[emoji];

    if (fn) {
      fn(ac, t0);
    } else {
      synthFallback(ac, t0, emoji);
    }
  } catch {
    // Audio is best-effort — never block reactions.
  }
}

/** Warm up the AudioContext and shared reverb on room join. */
export function preloadReactionSounds(): void {
  try {
    const ac = acquireCtx();
    if (!ac) return;
    // Play a silent burst at volume 0 to unlock the context
    const silent = ac.createOscillator();
    const g = G(ac, 0);
    silent.connect(g);
    if (_master) g.connect(_master);
    silent.start(ac.currentTime);
    silent.stop(ac.currentTime + 0.001);
  } catch {
    // ignore
  }
}

/** Release all Web Audio resources on room leave. */
export function disposeReactionSounds(): void {
  try {
    if (_ctx && _ctx.state !== "closed") {
      void _ctx.close();
    }
  } catch {
    // ignore
  } finally {
    _ctx = null;
    _master = null;
    _reverbSend = null;
    _isDucking = false;
  }
}
