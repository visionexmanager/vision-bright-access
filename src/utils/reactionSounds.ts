/**
 * Visionex Reaction Audio Engine v6 — Web Audio Synthesis
 *
 * Each emoji category has a unique synthesized sound that matches its emotion.
 * No external audio files needed — all sounds are generated via Web Audio API.
 *
 * Categories:
 *   applause   → Pink noise modulated at 3.5 Hz (realistic crowd clapping)
 *   laugh      → Sawtooth through resonant filter, pulsed at laugh rhythm
 *   heartbeat  → Two sine bursts (lub-dub), 420 ms apart, low frequency
 *   sad        → Descending sine sweep 650→180 Hz + soft exhale noise
 *   crowd      → Soft warm pink noise + low resonance (collective "aww")
 *   fire       → Pink noise burst with random crackling spikes
 *   celebration → Major chord (C4-E4-G4-C5) + sparkle tones
 *   gasp       → Filtered noise swept 200→1200 Hz over 350 ms
 *   approval   → Musical chime D5 (587 Hz) with harmonics
 *   cheer      → Ascending pitch sweep + crowd burst
 *
 * Public API (unchanged):
 *   playReactionSound(emoji)
 *   setVoiceSpeakingState(speaking)
 *   preloadReactionSounds()   — no-op in v6 (synthesis needs no preload)
 *   disposeReactionSounds()
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MASTER_LVL  = 0.72;
const DUCK_TARGET = 0.18;
const DUCK_RAMP   = 0.18;
const UNDUCK_RAMP = 0.70;
const MIN_GAP_MS  = 80;

// ─── Singleton State ──────────────────────────────────────────────────────────

let _ctx:     AudioContext | null = null;
let _master:  GainNode    | null = null;
let _lastPlay = 0;
let _isDucking = false;

// ─── Context ──────────────────────────────────────────────────────────────────

function acquireCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new Ctor({ latencyHint: "interactive" });
    }
    if (_ctx.state === "suspended") void _ctx.resume();
    if (!_master) {
      _master = _ctx.createGain();
      _master.gain.value = MASTER_LVL;
      _master.connect(_ctx.destination);
    }
    return _ctx;
  } catch {
    return null;
  }
}

// ─── Pink Noise (Paul Kellet's algorithm) ─────────────────────────────────────

function makePinkNoise(ac: AudioContext, durationS: number, amplitude = 1): AudioBuffer {
  const n = Math.ceil(ac.sampleRate * durationS);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
  for (let i = 0; i < n; i++) {
    const wh = Math.random() * 2 - 1;
    b0 = 0.99886*b0 + wh*0.0555179;
    b1 = 0.99332*b1 + wh*0.0750759;
    b2 = 0.96900*b2 + wh*0.1538520;
    b3 = 0.86650*b3 + wh*0.3104856;
    b4 = 0.55000*b4 + wh*0.5329522;
    b5 = -0.7616*b5 - wh*0.0168980;
    data[i] = (b0+b1+b2+b3+b4+b5+b6 + wh*0.5362) * 0.11 * amplitude;
    b6 = wh * 0.115926;
  }
  return buf;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scheduleOsc(
  ac: AudioContext, dest: AudioNode,
  type: OscillatorType, freq: number,
  pairs: [number, number][], now: number, dur: number, detune = 0,
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now + pairs[0][0]);
  for (let i = 1; i < pairs.length; i++) {
    g.gain.linearRampToValueAtTime(pairs[i][1], now + pairs[i][0]);
  }
  osc.connect(g); g.connect(dest);
  osc.start(now); osc.stop(now + dur);
}

// ─── Synthesizers ─────────────────────────────────────────────────────────────

function synthApplause(ac: AudioContext, dest: AudioNode, now: number) {
  const dur = 1.4;
  const sr = ac.sampleRate;
  const buf = ac.createBuffer(1, Math.ceil(sr * dur), sr);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < data.length; i++) {
    const wh = Math.random() * 2 - 1;
    b0=0.99886*b0+wh*0.0555179; b1=0.99332*b1+wh*0.0750759;
    b2=0.96900*b2+wh*0.1538520; b3=0.86650*b3+wh*0.3104856;
    b4=0.55000*b4+wh*0.5329522; b5=-0.7616*b5-wh*0.0168980;
    const pink = (b0+b1+b2+b3+b4+b5+b6+wh*0.5362)*0.11; b6=wh*0.115926;
    const t = i / sr;
    const phase = (t * 3.5) % 1;
    const clap = phase < 0.18 ? Math.pow(Math.sin(phase / 0.18 * Math.PI), 2) : 0;
    data[i] = pink * (clap * 0.85 + 0.15);
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2200; bp.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.9, now+0.06);
  g.gain.setValueAtTime(0.9, now+0.7); g.gain.linearRampToValueAtTime(0, now+dur);
  src.connect(bp); bp.connect(g); g.connect(dest); src.start(now);
}

function synthLaugh(ac: AudioContext, dest: AudioNode, now: number) {
  const dur = 1.0;
  for (let i = 0; i < 3; i++) {
    scheduleOsc(ac, dest, "sawtooth", 200 + i*80,
      [[0,0],[0.04,0.4-i*0.12],[0.35,0.5-i*0.12],[0.65,0.25],[dur,0]],
      now + i*0.05, dur + i*0.05);
  }
  const lfo = ac.createOscillator(); lfo.frequency.value = 5.2;
  const modGain = ac.createGain();
  modGain.gain.setValueAtTime(0, now); modGain.gain.linearRampToValueAtTime(0.35, now+0.08);
  modGain.gain.setValueAtTime(0.35, now+0.6); modGain.gain.linearRampToValueAtTime(0, now+dur);
  const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0;
  lfo.connect(lfoAmt); lfoAmt.connect(modGain.gain);
  lfo.start(now); lfo.stop(now+dur);
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; lp.Q.value = 2;
  modGain.connect(lp); lp.connect(dest);
}

function synthHeartbeat(ac: AudioContext, dest: AudioNode, now: number) {
  const beats: Array<[number, number, number, number]> = [
    [0.0,  52, 0.55, 0.22],
    [0.22, 58, 0.38, 0.16],
    [0.75, 52, 0.50, 0.22],
    [0.97, 58, 0.33, 0.16],
  ];
  for (const [off, freq, peak, dur] of beats) {
    scheduleOsc(ac, dest, "sine", freq,
      [[0,0],[0.015,peak],[0.06,peak*0.4],[dur,0]], now+off, dur);
    scheduleOsc(ac, dest, "sine", freq*2,
      [[0,0],[0.015,peak*0.15],[dur,0]], now+off, dur);
  }
}

function synthSad(ac: AudioContext, dest: AudioNode, now: number) {
  const osc = ac.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(650, now);
  osc.frequency.exponentialRampToValueAtTime(180, now+0.9);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.28, now+0.12); g.gain.linearRampToValueAtTime(0, now+0.9);
  osc.connect(g); g.connect(dest); osc.start(now); osc.stop(now+0.9);
  const exhale = makePinkNoise(ac, 0.8, 0.25);
  const src = ac.createBufferSource(); src.buffer = exhale;
  const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000;
  const eg = ac.createGain();
  eg.gain.setValueAtTime(0, now); eg.gain.linearRampToValueAtTime(0.15, now+0.1); eg.gain.linearRampToValueAtTime(0, now+0.8);
  src.connect(hp); hp.connect(eg); eg.connect(dest); src.start(now);
}

function synthCrowd(ac: AudioContext, dest: AudioNode, now: number) {
  const src = ac.createBufferSource(); src.buffer = makePinkNoise(ac, 0.9, 0.6);
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; lp.Q.value = 3.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.45, now+0.15); g.gain.linearRampToValueAtTime(0, now+0.9);
  src.connect(lp); lp.connect(g); g.connect(dest); src.start(now);
  scheduleOsc(ac, dest, "sine", 280, [[0,0],[0.12,0.12],[0.6,0.10],[0.9,0]], now, 0.9);
}

function synthFire(ac: AudioContext, dest: AudioNode, now: number) {
  const dur = 0.75;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < data.length; i++) {
    const wh = Math.random()*2-1;
    b0=0.99886*b0+wh*0.0555179; b1=0.99332*b1+wh*0.0750759;
    b2=0.96900*b2+wh*0.1538520; b3=0.86650*b3+wh*0.3104856;
    b4=0.55000*b4+wh*0.5329522; b5=-0.7616*b5-wh*0.0168980;
    const pink=(b0+b1+b2+b3+b4+b5+b6+wh*0.5362)*0.11; b6=wh*0.115926;
    const crackle = Math.random() < 0.008 ? (Math.random()*2-1)*1.8 : 0;
    data[i] = pink*0.7 + crackle*0.15;
  }
  const src = ac.createBufferSource(); src.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.7, now+0.04);
  g.gain.setValueAtTime(0.7, now+0.3); g.gain.linearRampToValueAtTime(0, now+dur);
  src.connect(lp); lp.connect(g); g.connect(dest); src.start(now);
}

function synthCelebration(ac: AudioContext, dest: AudioNode, now: number) {
  [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
    scheduleOsc(ac, dest, "triangle", freq,
      [[0,0],[0.03,0.32],[0.2,0.28],[0.7,0.12],[1.1,0]], now+i*0.025, 1.1, i*8);
  });
  for (let i = 0; i < 5; i++) {
    const freq = 1400 + Math.random()*1800;
    scheduleOsc(ac, dest, "sine", freq, [[0,0],[0.01,0.18],[0.18,0]], now+0.05+Math.random()*0.4, 0.2);
  }
  const ns = ac.createBufferSource(); ns.buffer = makePinkNoise(ac, 0.12, 0.9);
  const nhp = ac.createBiquadFilter(); nhp.type = "highpass"; nhp.frequency.value = 2000;
  const ng = ac.createGain(); ng.gain.setValueAtTime(0.4, now); ng.gain.linearRampToValueAtTime(0, now+0.12);
  ns.connect(nhp); nhp.connect(ng); ng.connect(dest); ns.start(now);
}

function synthGasp(ac: AudioContext, dest: AudioNode, now: number) {
  const dur = 0.42;
  const src = ac.createBufferSource(); src.buffer = makePinkNoise(ac, dur, 1.2);
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(200, now);
  bp.frequency.exponentialRampToValueAtTime(1200, now+dur*0.7);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.75, now+0.05);
  g.gain.linearRampToValueAtTime(0.5, now+dur*0.6); g.gain.linearRampToValueAtTime(0, now+dur);
  src.connect(bp); bp.connect(g); g.connect(dest); src.start(now);
}

function synthApproval(ac: AudioContext, dest: AudioNode, now: number) {
  const partials: [number, number][] = [[587.33,0.40],[1174.66,0.22],[880.00,0.16],[1318.51,0.10]];
  for (const [freq, amp] of partials) {
    scheduleOsc(ac, dest, "sine", freq,
      [[0,0],[0.008,amp],[0.05,amp*0.7],[0.5,amp*0.2],[0.9,0]], now, 0.9);
  }
  const cs = ac.createBufferSource(); cs.buffer = makePinkNoise(ac, 0.015, 0.8);
  const cg = ac.createGain(); cg.gain.setValueAtTime(0.3, now); cg.gain.linearRampToValueAtTime(0, now+0.015);
  cs.connect(cg); cg.connect(dest); cs.start(now);
}

function synthCheer(ac: AudioContext, dest: AudioNode, now: number) {
  const dur = 0.9;
  const osc = ac.createOscillator(); osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(900, now+dur*0.7);
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.38, now+0.08);
  g.gain.setValueAtTime(0.38, now+dur*0.55); g.gain.linearRampToValueAtTime(0, now+dur);
  osc.connect(lp); lp.connect(g); g.connect(dest); osc.start(now); osc.stop(now+dur);
  const ns = ac.createBufferSource(); ns.buffer = makePinkNoise(ac, dur, 0.7);
  const nhp = ac.createBiquadFilter(); nhp.type = "bandpass"; nhp.frequency.value = 1600; nhp.Q.value = 1.2;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0, now); ng.gain.linearRampToValueAtTime(0.4, now+0.1); ng.gain.linearRampToValueAtTime(0, now+dur);
  ns.connect(nhp); nhp.connect(ng); ng.connect(dest); ns.start(now);
}

// ─── Emoji → Synthesizer ──────────────────────────────────────────────────────

type Synth = (ac: AudioContext, dest: AudioNode, now: number) => void;
const EMOJI_SYNTH: Record<string, Synth> = {};

function reg(fn: Synth, ...emojis: string[]) {
  emojis.forEach(e => { EMOJI_SYNTH[e] = fn; });
}

reg(synthApplause,    "👏","🙌","🤲","🫶");
reg(synthLaugh,       "😂","🤣","😆","😅","😁","😄","😃","🤪","😜","😝","🤭","😬");
reg(synthHeartbeat,   "❤️","❤","💓","💗","💖","💝","💑","💕","💞","💘","🥰","😍");
reg(synthSad,         "😢","😭","🥺","😥","🥲","💔","😔","😞");
reg(synthCrowd,
  "☀️","🌙","⭐","🌟","💫","✨","🌈","❄️","🍀","🌸","🌺","🌻","🦋","💡",
  "💎","👑","🏅","💍","🫂","🤗","🌹","🎵","🎶","💐","🌿",
);
reg(synthFire,        "🔥","💥","🌋","⚡","🌩️","🌩","🔋");
reg(synthCelebration,
  "🎉","🎊","🥳","🎈","🎆","🎇","🧨",
  "🏆","💯","🥇","🎯","🎖️","🎖",
  "🎸","🎮","🎤","📣","📢","🎺","🥁","🎻","🎹",
  "🚀","🛸","✈️","✈",
);
reg(synthGasp,        "😮","🤯","😳","🫣","😲","🫢","😱","🙀","😡","😤","😠","🤬");
reg(synthApproval,
  "👍","👍🏼","👍🏽","👍🏾","👍🏿",
  "💪","🤙","✌️","✌","👋","🙋","🤜","🤛","🤞","👌","🤌","🫵",
  "🙏","😎","🤩","😏","🫡","✅","✔️",
);
reg(synthCheer,       "⚽","🏀","🎾","🏐","🏈","⚾","🥊","🏋️","🤸","⛷️","🏄","🤼","🥋","🏳️","🚩");

// ─── Emoji Normalisation ─────────────────────────────────────────────────────

function cleanEmoji(emoji: string): string {
  return Array.from(emoji)
    .filter(c => { const cp = c.codePointAt(0) ?? 0; return cp < 0x1f3fb || cp > 0x1f3ff; })
    .join("")
    .replace(/️/g, "")
    .replace(/‍/g, "");
}

// ─── Voice Ducking ────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function playReactionSound(emoji: string): void {
  const now = Date.now();
  if (now - _lastPlay < MIN_GAP_MS) return;
  _lastPlay = now;
  try {
    const ac = acquireCtx();
    if (!ac || !_master) return;
    const key = cleanEmoji(emoji);
    const synth = EMOJI_SYNTH[key] ?? EMOJI_SYNTH[emoji];
    if (!synth) return;
    synth(ac, _master, ac.currentTime);
  } catch {
    // Audio is best-effort — never block the reaction UI
  }
}

/** No-op in v6 — synthesis needs no preloading. */
export function preloadReactionSounds(): void {}

/** Release the AudioContext on room leave. */
export function disposeReactionSounds(): void {
  try {
    if (_ctx && _ctx.state !== "closed") void _ctx.close();
  } catch { /* ignore */ } finally {
    _ctx = null;
    _master = null;
    _isDucking = false;
    _lastPlay = 0;
  }
}
