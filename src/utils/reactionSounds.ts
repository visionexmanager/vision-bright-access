const MAX_REACTION_RATE_MS = 80;
const SKIN_TONE_REGEX = /[\u{1f3fb}-\u{1f3ff}\ufe0f]/gu;

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
  luck: ["\u270c", "\u{1f91e}", "\u{1f919}", "\u{1f64f}", "\u{1fae1}", "\u{1fae1}", "\u{1fae2}", "\u{1fae1}"],
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
  animals: ["\u{1f436}", "\u{1f63a}", "\u{1f984}", "\u{1f427}", "\u{1f98a}", "\u{1f438}"],
  spooky: ["\u{1f47b}", "\u{1f480}"],
  sciFi: ["\u{1f916}", "\u{1f47d}"],
};

function listIncludes(list: string[], emoji: string) {
  return list.includes(emoji);
}

function getAudioContext() {
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtor();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function cleanEmoji(emoji: string) {
  return emoji.replace(SKIN_TONE_REGEX, "");
}

function noiseBuffer(ctx: AudioContext, duration: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function noiseSource(ctx: AudioContext, duration: number) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  return source;
}

function osc(ctx: AudioContext, type: OscillatorType, freq: number) {
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.value = freq;
  return node;
}

function gain(ctx: AudioContext, value = 0) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

function biquad(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = freq;
  node.Q.value = q;
  return node;
}

function output(ctx: AudioContext) {
  const master = gain(ctx, 0.76);
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 18;
  compressor.ratio.value = 9;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return master;
}

function pulse(ctx: AudioContext, dest: AudioNode, at: number, freq: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const source = osc(ctx, type, freq);
  const env = gain(ctx);
  source.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.03);
}

function chirp(ctx: AudioContext, dest: AudioNode, at: number, from: number, to: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const source = osc(ctx, type, from);
  const env = gain(ctx);
  source.connect(env);
  env.connect(dest);
  source.frequency.setValueAtTime(from, at);
  source.frequency.exponentialRampToValueAtTime(to, at + duration);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(volume, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.03);
}

function noiseHit(ctx: AudioContext, dest: AudioNode, at: number, duration: number, volume: number, type: BiquadFilterType, freq: number, q = 1) {
  const source = noiseSource(ctx, duration);
  const filter = biquad(ctx, type, freq, q);
  const env = gain(ctx);
  source.connect(filter);
  filter.connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(volume, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function vocal(ctx: AudioContext, dest: AudioNode, at: number, from: number, to: number, duration: number, volume: number, formants: number[]) {
  const voice = osc(ctx, "sawtooth", from);
  const env = gain(ctx);
  voice.frequency.setValueAtTime(from, at);
  voice.frequency.linearRampToValueAtTime(to, at + duration * 0.72);

  formants.forEach((freq, index) => {
    const band = biquad(ctx, "bandpass", freq, index === 0 ? 7 : 5);
    const trim = gain(ctx, 1 / (index + 1));
    voice.connect(band);
    band.connect(trim);
    trim.connect(env);
  });

  env.connect(dest);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(volume, at + 0.025);
  env.gain.setValueAtTime(volume, at + duration * 0.42);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  voice.start(at);
  voice.stop(at + duration + 0.04);
}

function sparkle(ctx: AudioContext, dest: AudioNode, at: number, notes: number[], volume = 0.1) {
  notes.forEach((note, index) => pulse(ctx, dest, at + index * 0.055, note, 0.34, volume / (index * 0.2 + 1)));
}

function click(ctx: AudioContext, dest: AudioNode, at: number, volume = 0.22) {
  noiseHit(ctx, dest, at, 0.045, volume, "bandpass", 1200, 1.4);
  pulse(ctx, dest, at + 0.004, 180, 0.08, volume * 0.35);
}

function wobble(ctx: AudioContext, dest: AudioNode, at: number, base: number, duration: number, volume: number) {
  const source = osc(ctx, "sine", base);
  const trem = osc(ctx, "sine", 9);
  const tremGain = gain(ctx, volume * 0.45);
  const env = gain(ctx, volume);
  trem.connect(tremGain);
  tremGain.connect(env.gain);
  source.connect(env);
  env.connect(dest);
  source.frequency.setValueAtTime(base, at);
  source.frequency.linearRampToValueAtTime(base * 0.82, at + duration);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  trem.start(at);
  source.stop(at + duration + 0.03);
  trem.stop(at + duration + 0.03);
}

export function playReactionSound(emoji: string) {
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < MAX_REACTION_RATE_MS) return;
  lastPlayedAt = nowMs;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const e = cleanEmoji(emoji);
    const now = ctx.currentTime + 0.006;
    const out = output(ctx);

    if (listIncludes(E.laugh, e)) {
      [0, 0.13, 0.27, 0.42].forEach((offset, index) => {
        vocal(ctx, out, now + offset, 185 + index * 12, 228 + index * 7, 0.12, 0.2, [760, 1250, 2450]);
        noiseHit(ctx, out, now + offset, 0.055, 0.035, "highpass", 2300);
      });
    } else if (listIncludes(E.happy, e)) {
      vocal(ctx, out, now, 280, 335, 0.22, 0.12, [690, 1320]);
      sparkle(ctx, out, now + 0.12, [659, 880], 0.06);
    } else if (listIncludes(E.love, e)) {
      [[0, 62, 0.26, 0.36], [0.18, 49, 0.2, 0.27], [0.68, 62, 0.24, 0.28], [0.85, 49, 0.18, 0.2]].forEach(([offset, freq, duration, volume]) => {
        pulse(ctx, out, now + offset, freq, duration, volume);
      });
    } else if (listIncludes(E.cool, e)) {
      chirp(ctx, out, now, 360, 220, 0.34, 0.12, "triangle");
      click(ctx, out, now + 0.2, 0.11);
    } else if (listIncludes(E.celebrate, e)) {
      noiseHit(ctx, out, now, 0.07, 0.5, "bandpass", 650, 0.9);
      sparkle(ctx, out, now + 0.06, [1047, 1319, 1568, 2093], 0.1);
      if (e === "\u{1f973}") noiseHit(ctx, out, now + 0.03, 0.28, 0.12, "highpass", 2600);
    } else if (listIncludes(E.thinking, e)) {
      pulse(ctx, out, now, 360, 0.22, 0.11);
      pulse(ctx, out, now + 0.18, 470, 0.24, 0.09);
      vocal(ctx, out, now + 0.04, 150, 170, 0.32, 0.06, [430, 930]);
    } else if (listIncludes(E.annoyed, e)) {
      pulse(ctx, out, now, 240, 0.5, 0.18, "sawtooth");
      pulse(ctx, out, now + 0.18, 118, 0.36, 0.12, "sawtooth");
    } else if (listIncludes(E.angry, e)) {
      vocal(ctx, out, now, 135, 88, 0.38, 0.21, [420, 950]);
      noiseHit(ctx, out, now + 0.02, 0.22, 0.12, "lowpass", 380);
    } else if (listIncludes(E.sad, e)) {
      vocal(ctx, out, now, 260, 165, 0.52, 0.15, [620, 1150]);
      wobble(ctx, out, now + 0.2, 230, 0.28, 0.05);
      if (e === "\u{1f62d}") vocal(ctx, out, now + 0.35, 230, 140, 0.45, 0.13, [580, 1050]);
    } else if (listIncludes(E.wow, e)) {
      vocal(ctx, out, now, 170, 285, 0.32, 0.22, [520, 920, 1800]);
      noiseHit(ctx, out, now + 0.015, 0.28, 0.08, "highpass", 1900);
    } else if (listIncludes(E.sleepy, e)) {
      [330, 262, 196].forEach((freq, index) => pulse(ctx, out, now + index * 0.17, freq, 0.54, 0.075));
    } else if (listIncludes(E.awkward, e)) {
      wobble(ctx, out, now, 285, 0.42, 0.11);
      noiseHit(ctx, out, now + 0.02, 0.24, 0.035, "highpass", 2600);
    } else if (listIncludes(E.silent, e)) {
      noiseHit(ctx, out, now, 0.22, 0.07, "highpass", 3300);
    } else if (listIncludes(E.flat, e)) {
      pulse(ctx, out, now, 360, 0.14, 0.065);
      pulse(ctx, out, now + 0.2, 360, 0.14, 0.045);
    } else if (listIncludes(E.clap, e)) {
      [0, 0.09, 0.21].forEach((offset, index) => {
        noiseHit(ctx, out, now + offset, 0.12, 0.46 - index * 0.07, "bandpass", 1800 + index * 700, 2.5);
        noiseHit(ctx, out, now + offset + 0.006, 0.08, 0.22, "highpass", 4600);
        click(ctx, out, now + offset + 0.012, 0.14);
      });
    } else if (listIncludes(E.wave, e)) {
      sparkle(ctx, out, now, [523, 659], 0.1);
      [0, 0.1, 0.2].forEach((offset) => noiseHit(ctx, out, now + offset, 0.07, 0.07, "highpass", 1800));
    } else if (listIncludes(E.handshake, e)) {
      noiseHit(ctx, out, now, 0.09, 0.34, "bandpass", 950, 1.6);
      noiseHit(ctx, out, now + 0.08, 0.09, 0.24, "bandpass", 1350, 1.8);
    } else if (listIncludes(E.luck, e)) {
      sparkle(ctx, out, now, [523, 659], 0.1);
    } else if (listIncludes(E.power, e)) {
      noiseHit(ctx, out, now, 0.12, 0.55, "bandpass", 950, 1.5);
      pulse(ctx, out, now, 78, 0.34, 0.42);
      pulse(ctx, out, now + 0.015, 43, 0.28, 0.24);
    } else if (listIncludes(E.dance, e)) {
      [0, 0.16, 0.32].forEach((offset) => noiseHit(ctx, out, now + offset, 0.08, 0.24, "bandpass", 150, 4));
      [196, 247, 294, 370].forEach((freq, index) => pulse(ctx, out, now + index * 0.09, freq, 0.42, 0.11, "triangle"));
    } else if (listIncludes(E.facepalm, e)) {
      click(ctx, out, now, 0.36);
      vocal(ctx, out, now + 0.05, 160, 110, 0.28, 0.1, [450, 900]);
    } else if (listIncludes(E.shrug, e)) {
      chirp(ctx, out, now, 300, 410, 0.2, 0.08);
      chirp(ctx, out, now + 0.16, 410, 300, 0.24, 0.08);
    } else if (listIncludes(E.fire, e)) {
      noiseHit(ctx, out, now, 0.58, 0.2, "bandpass", 3300, 1.4);
      noiseHit(ctx, out, now + 0.05, 0.46, 0.09, "lowpass", 220);
      [0.08, 0.19, 0.32, 0.45].forEach((offset) => noiseHit(ctx, out, now + offset, 0.035, 0.28, "highpass", 5200));
    } else if (listIncludes(E.success, e)) {
      sparkle(ctx, out, now, e === "\u{1f4a1}" ? [660, 880, 1320] : [880, 1320, 1760], 0.12);
    } else if (listIncludes(E.rocket, e)) {
      noiseHit(ctx, out, now, 0.58, 0.25, "bandpass", 260, 2.8);
      sparkle(ctx, out, now + 0.28, [880, 1175, 1568], 0.07);
    } else if (listIncludes(E.nature, e)) {
      sparkle(ctx, out, now, [1047, 1319, 1568], 0.085);
      if (e === "\u2744") noiseHit(ctx, out, now + 0.08, 0.22, 0.04, "highpass", 5200);
    } else if (listIncludes(E.water, e)) {
      noiseHit(ctx, out, now, 0.9, 0.26, "lowpass", 680, 0.8);
    } else if (listIncludes(E.lightning, e)) {
      noiseHit(ctx, out, now, 0.06, 0.6, "highpass", 4800);
      pulse(ctx, out, now + 0.04, 115, 0.22, 0.13, "square");
    } else if (listIncludes(E.music, e)) {
      [196, 247, 294, 370].forEach((freq, index) => pulse(ctx, out, now + index * 0.09, freq, 0.46, 0.14, "triangle"));
    } else if (listIncludes(E.game, e)) {
      [330, 392, 494, 659].forEach((freq, index) => pulse(ctx, out, now + index * 0.075, freq, 0.08, 0.09, "square"));
    } else if (listIncludes(E.ball, e)) {
      [0, 0.12, 0.22].forEach((offset, index) => noiseHit(ctx, out, now + offset, 0.09, 0.34 - index * 0.09, "bandpass", 120 - index * 18, 4));
    } else if (listIncludes(E.food, e)) {
      noiseHit(ctx, out, now, 0.055, 0.32, "bandpass", 850, 1.2);
      pulse(ctx, out, now + 0.05, 880, 0.28, 0.08);
    } else if (listIncludes(E.animals, e)) {
      if (e === "\u{1f436}") {
        chirp(ctx, out, now, 360, 520, 0.085, 0.13, "triangle");
        chirp(ctx, out, now + 0.11, 420, 620, 0.09, 0.11, "triangle");
      } else if (e === "\u{1f63a}") {
        vocal(ctx, out, now, 520, 690, 0.22, 0.12, [900, 1600]);
        chirp(ctx, out, now + 0.18, 780, 560, 0.12, 0.06);
      } else if (e === "\u{1f438}") {
        vocal(ctx, out, now, 145, 205, 0.16, 0.17, [390, 740]);
        vocal(ctx, out, now + 0.17, 135, 190, 0.16, 0.15, [360, 700]);
      } else if (e === "\u{1f427}") {
        chirp(ctx, out, now, 620, 820, 0.09, 0.1);
        chirp(ctx, out, now + 0.11, 760, 560, 0.12, 0.08);
      } else if (e === "\u{1f98a}") {
        vocal(ctx, out, now, 410, 610, 0.2, 0.11, [820, 1750]);
        chirp(ctx, out, now + 0.16, 520, 760, 0.11, 0.08);
      } else {
        sparkle(ctx, out, now, [784, 1047, 1568, 2093, 2637], 0.12);
        chirp(ctx, out, now + 0.12, 900, 1800, 0.34, 0.045);
      }
    } else if (listIncludes(E.spooky, e)) {
      vocal(ctx, out, now, 420, 220, 0.5, 0.16, [800, 1700]);
      noiseHit(ctx, out, now + 0.15, 0.22, 0.04, "highpass", 3600);
    } else if (listIncludes(E.sciFi, e)) {
      vocal(ctx, out, now, 160, 85, 0.5, 0.16, [500, 1500]);
      pulse(ctx, out, now + 0.02, 80, 0.42, 0.08, "square");
      chirp(ctx, out, now + 0.16, 900, 420, 0.22, 0.045, "square");
    } else {
      pulse(ctx, out, now, 640, 0.18, 0.09);
      pulse(ctx, out, now + 0.07, 960, 0.18, 0.055);
    }
  } catch {
    // Audio is best-effort; browser autoplay or device errors should not block reactions.
  }
}
