const MAX_REACTION_RATE_MS = 70;
const VARIATION_SELECTOR = "\ufe0f";
const ZERO_WIDTH_JOINER = "\u200d";

let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

const E = {
  laugh: ["\u{1f602}", "\u{1f606}", "\u{1f605}", "\u{1f923}", "\u{1f601}", "\u{1f92a}", "\u{1f61c}", "\u{1f61d}"],
  happy: ["\u{1f60a}", "\u{1f979}", "\u{1f607}", "\u{1f92d}"],
  love: ["\u2764", "\u{1f970}", "\u{1f60d}", "\u{1f495}", "\u{1f497}", "\u{1f493}", "\u{1f49e}", "\u{1fac2}", "\u{1faf6}"],
  cool: ["\u{1f60e}", "\u{1f60f}"],
  celebrate: ["\u{1f929}", "\u{1f973}", "\u{1f389}", "\u{1f38a}", "\u{1f388}", "\u{1f381}"],
  thinking: ["\u{1f914}", "\u{1f928}"],
  annoyed: ["\u{1f612}", "\u{1f644}", "\u{1f44e}"],
  angry: ["\u{1f624}", "\u{1f621}"],
  sad: ["\u{1f622}", "\u{1f62d}", "\u{1f97a}"],
  wow: ["\u{1f62e}", "\u{1f92f}", "\u{1f631}", "\u{1fae2}", "\u{1fae3}", "\u{1f633}"],
  sleepy: ["\u{1f634}", "\u{1f971}", "\u{1f319}"],
  awkward: ["\u{1f62c}", "\u{1fae0}"],
  silent: ["\u{1f910}", "\u{1f636}", "\u{1f92b}"],
  flat: ["\u{1f610}", "\u{1f611}"],
  clap: ["\u{1f44f}", "\u{1f64c}"],
  wave: ["\u{1f44b}", "\u{1f64b}"],
  handshake: ["\u{1f91d}"],
  luck: ["\u270c", "\u{1f91e}", "\u{1f919}", "\u{1f64f}", "\u{1fae1}"],
  power: ["\u{1f4aa}", "\u{1f91c}", "\u{1f91b}", "\u{1f4a5}"],
  dance: ["\u{1f483}", "\u{1f57a}"],
  facepalm: ["\u{1f926}"],
  shrug: ["\u{1f937}"],
  fire: ["\u{1f525}"],
  success: ["\u{1f44d}", "\u{1f4af}", "\u2b50", "\u{1f31f}", "\u2728", "\u{1f4ab}", "\u{1f48e}", "\u{1f3c6}", "\u{1f947}", "\u{1f3af}", "\u{1f4a1}"],
  rocket: ["\u{1f680}"],
  nature: ["\u2744", "\u{1f308}", "\u2600", "\u{1f340}", "\u{1f98b}", "\u{1f338}", "\u{1f33a}", "\u{1f33b}"],
  water: ["\u{1f30a}"],
  lightning: ["\u26a1"],
  music: ["\u{1f3b5}", "\u{1f3b6}", "\u{1f3b8}"],
  game: ["\u{1f3ae}"],
  ball: ["\u26bd", "\u{1f3c0}"],
  food: ["\u{1f355}", "\u{1f354}", "\u{1f9c1}", "\u{1f36d}"],
  animal: ["\u{1f436}", "\u{1f63a}", "\u{1f984}", "\u{1f427}", "\u{1f98a}", "\u{1f438}"],
  spooky: ["\u{1f47b}", "\u{1f480}"],
  sciFi: ["\u{1f916}", "\u{1f47d}"],
};

function getAudioContext() {
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext || audioContext.state === "closed") audioContext = new AudioCtor();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function cleanEmoji(emoji: string) {
  return Array.from(emoji)
    .filter((char) => {
      const cp = char.codePointAt(0) ?? 0;
      return cp < 0x1f3fb || cp > 0x1f3ff;
    })
    .join("")
    .replaceAll(VARIATION_SELECTOR, "")
    .replaceAll(ZERO_WIDTH_JOINER, "");
}

function includes(list: string[], emoji: string) {
  return list.includes(emoji);
}

function hashEmoji(emoji: string) {
  return Array.from(emoji).reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0);
}

function gain(ctx: AudioContext, value = 0) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

function makeCurve(amount = 2.2) {
  const samples = 512;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

function output(ctx: AudioContext) {
  const master = gain(ctx, 0.88);
  const warmth = ctx.createWaveShaper();
  warmth.curve = makeCurve();
  warmth.oversample = "2x";
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 14;
  compressor.ratio.value = 10;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.16;
  master.connect(warmth);
  warmth.connect(compressor);
  compressor.connect(ctx.destination);
  return master;
}

function noiseBuffer(ctx: AudioContext, duration: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    last = last * 0.42 + (Math.random() * 2 - 1) * 0.58;
    data[i] = last;
  }
  return buffer;
}

function tone(ctx: AudioContext, dest: AudioNode, at: number, freq: number, duration: number, volume: number, type: OscillatorType = "sine", endFreq = freq) {
  const source = ctx.createOscillator();
  const env = gain(ctx);
  source.type = type;
  source.frequency.setValueAtTime(freq, at);
  if (endFreq !== freq) source.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), at + duration);
  source.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  env.gain.setValueAtTime(volume * 0.82, at + duration * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.04);
}

function noiseHit(ctx: AudioContext, dest: AudioNode, at: number, duration: number, volume: number, type: BiquadFilterType, freq: number, q = 1.2) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = gain(ctx);
  source.buffer = noiseBuffer(ctx, duration);
  filter.type = type;
  filter.frequency.setValueAtTime(freq, at);
  filter.Q.value = q;
  source.connect(filter);
  filter.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function vocal(ctx: AudioContext, dest: AudioNode, at: number, from: number, to: number, duration: number, volume: number, formants: number[]) {
  const voice = ctx.createOscillator();
  const env = gain(ctx);
  voice.type = "sawtooth";
  voice.frequency.setValueAtTime(from, at);
  voice.frequency.exponentialRampToValueAtTime(to, at + duration * 0.8);
  formants.forEach((freq, index) => {
    const band = ctx.createBiquadFilter();
    const trim = gain(ctx, 1 / (index + 1.2));
    band.type = "bandpass";
    band.frequency.value = freq;
    band.Q.value = index === 0 ? 8 : 5;
    voice.connect(band);
    band.connect(trim);
    trim.connect(env);
  });
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.018);
  env.gain.setValueAtTime(volume, at + duration * 0.36);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  voice.start(at);
  voice.stop(at + duration + 0.04);
}

function sparkle(ctx: AudioContext, dest: AudioNode, at: number, notes: number[], volume = 0.12) {
  notes.forEach((note, index) => tone(ctx, dest, at + index * 0.052, note, 0.24, volume / (1 + index * 0.18), "triangle", note * 1.01));
}

function clap(ctx: AudioContext, dest: AudioNode, at: number, count = 3) {
  for (let i = 0; i < count; i += 1) {
    const t = at + i * 0.085 + Math.random() * 0.012;
    noiseHit(ctx, dest, t, 0.08, 0.52 - i * 0.06, "bandpass", 1500 + i * 520, 2.6);
    noiseHit(ctx, dest, t + 0.006, 0.05, 0.22, "highpass", 4200, 0.9);
    tone(ctx, dest, t + 0.004, 155, 0.055, 0.08, "sine", 105);
  }
}

function whoosh(ctx: AudioContext, dest: AudioNode, at: number, duration: number, volume: number, from: number, to: number) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const env = gain(ctx);
  source.buffer = noiseBuffer(ctx, duration);
  filter.type = "bandpass";
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  source.connect(filter);
  filter.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(volume, at + duration * 0.25);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function fallbackSound(ctx: AudioContext, dest: AudioNode, at: number, emoji: string) {
  const hash = hashEmoji(emoji);
  const root = 330 + (hash % 8) * 42;
  const mode = hash % 4;
  if (mode === 0) {
    sparkle(ctx, dest, at, [root, root * 1.25, root * 1.5], 0.1);
  } else if (mode === 1) {
    tone(ctx, dest, at, root * 1.2, 0.16, 0.12, "square", root * 0.8);
    noiseHit(ctx, dest, at + 0.035, 0.08, 0.16, "bandpass", 1200);
  } else if (mode === 2) {
    whoosh(ctx, dest, at, 0.26, 0.12, 450, 1800);
    tone(ctx, dest, at + 0.16, root, 0.18, 0.09, "triangle", root * 1.4);
  } else {
    tone(ctx, dest, at, root, 0.11, 0.12, "sine");
    tone(ctx, dest, at + 0.09, root * 1.33, 0.12, 0.09, "sine");
  }
}

export function playReactionSound(emoji: string) {
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < MAX_REACTION_RATE_MS) return;
  lastPlayedAt = nowMs;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const e = cleanEmoji(emoji);
    const now = ctx.currentTime + 0.008;
    const out = output(ctx);

    if (includes(E.laugh, e)) {
      [0, 0.12, 0.25, 0.39].forEach((offset, index) => {
        vocal(ctx, out, now + offset, 190 + index * 18, 260 + index * 10, 0.115, 0.24, [760, 1240, 2460]);
        noiseHit(ctx, out, now + offset + 0.012, 0.035, 0.045, "highpass", 2400);
      });
    } else if (includes(E.happy, e)) {
      vocal(ctx, out, now, 285, 360, 0.2, 0.14, [720, 1360]);
      sparkle(ctx, out, now + 0.11, [660, 880, 1320], 0.08);
    } else if (includes(E.love, e)) {
      tone(ctx, out, now, 58, 0.2, 0.36, "sine", 52);
      tone(ctx, out, now + 0.22, 48, 0.18, 0.24, "sine", 44);
      tone(ctx, out, now + 0.6, 58, 0.2, 0.3, "sine", 52);
      sparkle(ctx, out, now + 0.42, [523, 659], 0.035);
    } else if (includes(E.cool, e)) {
      tone(ctx, out, now, 330, 0.32, 0.15, "triangle", 190);
      noiseHit(ctx, out, now + 0.2, 0.055, 0.2, "bandpass", 1200);
    } else if (includes(E.celebrate, e)) {
      noiseHit(ctx, out, now, 0.08, 0.52, "bandpass", 680, 0.8);
      whoosh(ctx, out, now + 0.02, 0.28, 0.12, 900, 3600);
      sparkle(ctx, out, now + 0.07, [1047, 1319, 1568, 2093], 0.12);
    } else if (includes(E.thinking, e)) {
      vocal(ctx, out, now, 145, 165, 0.3, 0.08, [430, 920]);
      tone(ctx, out, now + 0.02, 360, 0.18, 0.12);
      tone(ctx, out, now + 0.22, 480, 0.22, 0.1);
    } else if (includes(E.annoyed, e)) {
      tone(ctx, out, now, 230, 0.48, 0.22, "sawtooth", 118);
      noiseHit(ctx, out, now + 0.08, 0.16, 0.08, "lowpass", 420);
    } else if (includes(E.angry, e)) {
      vocal(ctx, out, now, 135, 82, 0.36, 0.24, [410, 920]);
      noiseHit(ctx, out, now + 0.025, 0.22, 0.18, "lowpass", 360);
      tone(ctx, out, now + 0.04, 70, 0.22, 0.22, "square", 54);
    } else if (includes(E.sad, e)) {
      vocal(ctx, out, now, 260, 150, 0.54, 0.16, [620, 1120]);
      tone(ctx, out, now + 0.22, 220, 0.36, 0.06, "sine", 170);
      if (e === "\u{1f62d}") vocal(ctx, out, now + 0.38, 235, 135, 0.44, 0.14, [580, 1030]);
    } else if (includes(E.wow, e)) {
      vocal(ctx, out, now, 165, 310, 0.34, 0.24, [520, 930, 1800]);
      whoosh(ctx, out, now + 0.02, 0.22, 0.09, 1400, 3600);
    } else if (includes(E.sleepy, e)) {
      [330, 262, 196].forEach((freq, index) => tone(ctx, out, now + index * 0.17, freq, 0.54, 0.08));
      whoosh(ctx, out, now + 0.06, 0.6, 0.035, 700, 260);
    } else if (includes(E.awkward, e)) {
      tone(ctx, out, now, 280, 0.38, 0.13, "sine", 240);
      tone(ctx, out, now + 0.09, 315, 0.22, 0.08, "triangle", 250);
      noiseHit(ctx, out, now + 0.03, 0.2, 0.05, "highpass", 2800);
    } else if (includes(E.silent, e)) {
      noiseHit(ctx, out, now, 0.18, 0.08, "highpass", 3600);
      tone(ctx, out, now + 0.12, 700, 0.05, 0.035, "sine", 620);
    } else if (includes(E.flat, e)) {
      tone(ctx, out, now, 360, 0.12, 0.08);
      tone(ctx, out, now + 0.18, 360, 0.12, 0.06);
    } else if (includes(E.clap, e)) {
      clap(ctx, out, now, e === "\u{1f64c}" ? 5 : 3);
    } else if (includes(E.wave, e)) {
      whoosh(ctx, out, now, 0.3, 0.12, 700, 1900);
      sparkle(ctx, out, now + 0.12, [523, 659], 0.08);
    } else if (includes(E.handshake, e)) {
      noiseHit(ctx, out, now, 0.08, 0.36, "bandpass", 900, 1.7);
      noiseHit(ctx, out, now + 0.075, 0.08, 0.28, "bandpass", 1350, 1.9);
      tone(ctx, out, now + 0.02, 105, 0.12, 0.12, "sine", 92);
    } else if (includes(E.luck, e)) {
      sparkle(ctx, out, now, [523, 659, 784], 0.1);
    } else if (includes(E.power, e)) {
      noiseHit(ctx, out, now, 0.12, 0.58, "bandpass", 950, 1.5);
      tone(ctx, out, now, 76, 0.34, 0.45, "sine", 48);
      tone(ctx, out, now + 0.015, 43, 0.28, 0.25, "sine", 36);
    } else if (includes(E.dance, e)) {
      [0, 0.16, 0.32].forEach((offset) => noiseHit(ctx, out, now + offset, 0.08, 0.26, "bandpass", 150, 4));
      [196, 247, 294, 370].forEach((freq, index) => tone(ctx, out, now + index * 0.09, freq, 0.36, 0.13, "triangle"));
    } else if (includes(E.facepalm, e)) {
      clap(ctx, out, now, 1);
      vocal(ctx, out, now + 0.06, 155, 108, 0.28, 0.1, [450, 900]);
    } else if (includes(E.shrug, e)) {
      tone(ctx, out, now, 300, 0.18, 0.09, "sine", 410);
      tone(ctx, out, now + 0.15, 410, 0.22, 0.09, "sine", 300);
    } else if (includes(E.fire, e)) {
      noiseHit(ctx, out, now, 0.58, 0.24, "bandpass", 3100, 1.3);
      noiseHit(ctx, out, now + 0.05, 0.46, 0.12, "lowpass", 220);
      [0.08, 0.19, 0.32, 0.45].forEach((offset) => noiseHit(ctx, out, now + offset, 0.035, 0.25, "highpass", 5200));
    } else if (includes(E.success, e)) {
      const notes = e === "\u{1f4a1}" ? [660, 880, 1320] : [880, 1175, 1568, 2093];
      sparkle(ctx, out, now, notes, 0.13);
    } else if (includes(E.rocket, e)) {
      whoosh(ctx, out, now, 0.62, 0.28, 240, 2400);
      tone(ctx, out, now, 80, 0.42, 0.22, "sawtooth", 120);
      sparkle(ctx, out, now + 0.31, [880, 1175, 1568], 0.08);
    } else if (includes(E.nature, e)) {
      whoosh(ctx, out, now, 0.36, 0.06, 1000, 2200);
      sparkle(ctx, out, now + 0.02, [1047, 1319, 1568], 0.08);
    } else if (includes(E.water, e)) {
      whoosh(ctx, out, now, 0.9, 0.22, 900, 260);
      noiseHit(ctx, out, now + 0.06, 0.55, 0.12, "lowpass", 520);
    } else if (includes(E.lightning, e)) {
      noiseHit(ctx, out, now, 0.055, 0.62, "highpass", 4800);
      tone(ctx, out, now + 0.035, 115, 0.2, 0.16, "square", 58);
    } else if (includes(E.music, e)) {
      [196, 247, 294, 370, 494].forEach((freq, index) => tone(ctx, out, now + index * 0.08, freq, 0.34, 0.14, "triangle"));
    } else if (includes(E.game, e)) {
      [330, 392, 494, 659].forEach((freq, index) => tone(ctx, out, now + index * 0.07, freq, 0.08, 0.1, "square"));
    } else if (includes(E.ball, e)) {
      [0, 0.12, 0.22].forEach((offset, index) => {
        noiseHit(ctx, out, now + offset, 0.085, 0.34 - index * 0.09, "bandpass", 130 - index * 18, 4);
        tone(ctx, out, now + offset, 110 - index * 12, 0.08, 0.08, "sine", 70);
      });
    } else if (includes(E.food, e)) {
      noiseHit(ctx, out, now, 0.055, 0.34, "bandpass", 850, 1.2);
      tone(ctx, out, now + 0.05, 880, 0.22, 0.08);
    } else if (includes(E.animal, e)) {
      if (e === "\u{1f436}") {
        vocal(ctx, out, now, 360, 520, 0.09, 0.14, [700, 1350]);
        vocal(ctx, out, now + 0.11, 420, 620, 0.09, 0.12, [760, 1450]);
      } else if (e === "\u{1f63a}") {
        vocal(ctx, out, now, 520, 690, 0.22, 0.13, [900, 1600]);
        tone(ctx, out, now + 0.18, 780, 0.12, 0.06, "sine", 560);
      } else if (e === "\u{1f438}") {
        vocal(ctx, out, now, 145, 205, 0.16, 0.18, [390, 740]);
        vocal(ctx, out, now + 0.17, 135, 190, 0.16, 0.16, [360, 700]);
      } else {
        fallbackSound(ctx, out, now, e);
      }
    } else if (includes(E.spooky, e)) {
      vocal(ctx, out, now, 420, 210, 0.5, 0.17, [800, 1700]);
      whoosh(ctx, out, now + 0.08, 0.4, 0.06, 1600, 360);
    } else if (includes(E.sciFi, e)) {
      vocal(ctx, out, now, 160, 85, 0.48, 0.16, [500, 1500]);
      tone(ctx, out, now + 0.02, 80, 0.42, 0.09, "square");
      tone(ctx, out, now + 0.16, 900, 0.22, 0.05, "square", 420);
    } else {
      fallbackSound(ctx, out, now, e);
    }
  } catch {
    // Audio is best-effort; browser autoplay or device errors should not block reactions.
  }
}
