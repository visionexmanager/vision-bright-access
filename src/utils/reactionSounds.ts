type SoundContext = AudioContext & {
  webkitAudioContext?: typeof AudioContext;
};

const MAX_REACTION_RATE_MS = 90;
const SKIN_TONE_REGEX = /[\u{1f3fb}-\u{1f3ff}\ufe0f]/gu;

let audioContext: AudioContext | null = null;
let lastPlayedAt = 0;

function getAudioContext() {
  const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtor() as SoundContext;
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

function sourceNoise(ctx: AudioContext, duration: number) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  return source;
}

function oscillator(ctx: AudioContext, type: OscillatorType, frequency: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  return osc;
}

function gain(ctx: AudioContext, value = 0) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 1) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

function output(ctx: AudioContext) {
  const master = gain(ctx, 0.72);
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  return master;
}

function pulse(ctx: AudioContext, destination: AudioNode, at: number, frequency: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const osc = oscillator(ctx, type, frequency);
  const env = gain(ctx);
  osc.connect(env);
  env.connect(destination);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.start(at);
  osc.stop(at + duration + 0.03);
}

function noiseHit(ctx: AudioContext, destination: AudioNode, at: number, duration: number, volume: number, filterType: BiquadFilterType, frequency: number, q = 1) {
  const source = sourceNoise(ctx, duration);
  const band = filter(ctx, filterType, frequency, q);
  const env = gain(ctx);
  source.connect(band);
  band.connect(env);
  env.connect(destination);
  env.gain.setValueAtTime(volume, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.start(at);
  source.stop(at + duration + 0.02);
}

function vocal(ctx: AudioContext, destination: AudioNode, at: number, startFreq: number, endFreq: number, duration: number, volume: number, formants: number[]) {
  const voice = oscillator(ctx, "sawtooth", startFreq);
  const env = gain(ctx);
  voice.frequency.setValueAtTime(startFreq, at);
  voice.frequency.linearRampToValueAtTime(endFreq, at + duration * 0.75);
  formants.forEach((freq, index) => {
    const band = filter(ctx, "bandpass", freq, index === 0 ? 7 : 5);
    const bandGain = gain(ctx, 1 / (index + 1));
    voice.connect(band);
    band.connect(bandGain);
    bandGain.connect(env);
  });
  env.connect(destination);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.linearRampToValueAtTime(volume, at + 0.025);
  env.gain.setValueAtTime(volume, at + duration * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  voice.start(at);
  voice.stop(at + duration + 0.04);
}

function sparkle(ctx: AudioContext, destination: AudioNode, at: number, notes: number[], volume = 0.1) {
  notes.forEach((note, index) => {
    pulse(ctx, destination, at + index * 0.055, note, 0.34, volume / (index * 0.2 + 1));
  });
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
    const master = output(ctx);

    if (["😂", "😆", "😅", "🤣", "😁", "🤪", "😜", "😝"].includes(e)) {
      [0, 0.13, 0.27, 0.42].forEach((offset, index) => {
        vocal(ctx, master, now + offset, 185 + index * 12, 225 + index * 7, 0.12, 0.2, [760, 1250, 2450]);
        noiseHit(ctx, master, now + offset, 0.055, 0.035, "highpass", 2300);
      });
    } else if (["👏", "🙌"].includes(e)) {
      [0, 0.09, 0.21].forEach((offset, index) => {
        noiseHit(ctx, master, now + offset, 0.12, 0.46 - index * 0.07, "bandpass", 1800 + index * 700, 2.5);
        noiseHit(ctx, master, now + offset + 0.006, 0.08, 0.22, "highpass", 4600);
      });
    } else if (["❤️", "❤", "🥰", "😍", "💕", "💗", "💓", "💞", "🫂", "🫶"].includes(e)) {
      [[0, 62, 0.26, 0.36], [0.18, 49, 0.2, 0.27], [0.68, 62, 0.24, 0.28], [0.85, 49, 0.18, 0.2]].forEach(([offset, freq, duration, volume]) => {
        pulse(ctx, master, now + offset, freq, duration, volume);
      });
    } else if (["😮", "🤯", "😱", "🫢", "🫣", "😳"].includes(e)) {
      vocal(ctx, master, now, 170, 285, 0.32, 0.22, [520, 920, 1800]);
      noiseHit(ctx, master, now + 0.015, 0.28, 0.08, "highpass", 1900);
    } else if (["💪", "🤜", "🤛", "💥"].includes(e)) {
      noiseHit(ctx, master, now, 0.12, 0.55, "bandpass", 950, 1.5);
      pulse(ctx, master, now, 78, 0.34, 0.42);
      pulse(ctx, master, now + 0.015, 43, 0.28, 0.24);
    } else if (["🔥"].includes(e)) {
      noiseHit(ctx, master, now, 0.58, 0.2, "bandpass", 3300, 1.4);
      noiseHit(ctx, master, now + 0.05, 0.46, 0.09, "lowpass", 220);
      [0.08, 0.19, 0.32, 0.45].forEach((offset) => noiseHit(ctx, master, now + offset, 0.035, 0.28, "highpass", 5200));
    } else if (["⚡"].includes(e)) {
      noiseHit(ctx, master, now, 0.06, 0.6, "highpass", 4800);
      pulse(ctx, master, now + 0.04, 115, 0.22, 0.13, "square");
    } else if (["🚀"].includes(e)) {
      noiseHit(ctx, master, now, 0.58, 0.25, "bandpass", 260, 2.8);
      sparkle(ctx, master, now + 0.28, [880, 1175, 1568], 0.07);
    } else if (["🌊"].includes(e)) {
      noiseHit(ctx, master, now, 0.9, 0.26, "lowpass", 680, 0.8);
    } else if (["🎉", "🎊", "🎈", "🎁", "🥳"].includes(e)) {
      noiseHit(ctx, master, now, 0.07, 0.5, "bandpass", 650, 0.9);
      sparkle(ctx, master, now + 0.06, [1047, 1319, 1568, 2093], 0.1);
    } else if (["🎵", "🎶", "🎸", "💃", "🕺"].includes(e)) {
      [196, 247, 294, 370].forEach((freq, index) => pulse(ctx, master, now + index * 0.09, freq, 0.46, 0.14, "triangle"));
      if (["💃", "🕺"].includes(e)) [0, 0.16, 0.32].forEach((offset) => noiseHit(ctx, master, now + offset, 0.08, 0.24, "bandpass", 150, 4));
    } else if (["👍", "💯", "🏆", "🥇", "⭐", "🌟", "✨", "💫", "💎", "🎯", "🤩", "💡"].includes(e)) {
      sparkle(ctx, master, now, e === "💡" ? [660, 880, 1320] : [880, 1320, 1760], 0.12);
    } else if (["😡", "😤"].includes(e)) {
      vocal(ctx, master, now, 135, 88, 0.38, 0.21, [420, 950]);
      noiseHit(ctx, master, now + 0.02, 0.22, 0.12, "lowpass", 380);
    } else if (["👎", "🙄", "😒"].includes(e)) {
      pulse(ctx, master, now, 240, 0.5, 0.18, "sawtooth");
      pulse(ctx, master, now + 0.18, 118, 0.36, 0.12, "sawtooth");
    } else if (["😢", "😭", "🥺"].includes(e)) {
      vocal(ctx, master, now, 260, 165, 0.52, 0.15, [620, 1150]);
      if (e === "😭") vocal(ctx, master, now + 0.35, 230, 140, 0.45, 0.13, [580, 1050]);
    } else if (["🙏", "🫡", "✌", "✌️", "🤞", "🤙", "🙋", "👋"].includes(e)) {
      sparkle(ctx, master, now, [523, 659], 0.1);
      if (e === "👋") [0, 0.1, 0.2].forEach((offset) => noiseHit(ctx, master, now + offset, 0.07, 0.07, "highpass", 1800));
    } else if (["🤝"].includes(e)) {
      noiseHit(ctx, master, now, 0.09, 0.34, "bandpass", 950, 1.6);
      noiseHit(ctx, master, now + 0.08, 0.09, 0.24, "bandpass", 1350, 1.8);
    } else if (["😴", "🥱", "🌙"].includes(e)) {
      [330, 262, 196].forEach((freq, index) => pulse(ctx, master, now + index * 0.17, freq, 0.54, 0.075));
    } else if (["🤔", "🤨"].includes(e)) {
      pulse(ctx, master, now, 360, 0.22, 0.11);
      pulse(ctx, master, now + 0.18, 470, 0.24, 0.09);
    } else if (["🤫", "🤐", "😶"].includes(e)) {
      noiseHit(ctx, master, now, 0.22, 0.07, "highpass", 3300);
    } else if (["🎮"].includes(e)) {
      [330, 392, 494, 659].forEach((freq, index) => pulse(ctx, master, now + index * 0.075, freq, 0.08, 0.09, "square"));
    } else if (["⚽", "🏀"].includes(e)) {
      [0, 0.12, 0.22].forEach((offset, index) => noiseHit(ctx, master, now + offset, 0.09, 0.34 - index * 0.09, "bandpass", 120 - index * 18, 4));
    } else if (["🍕", "🍔", "🧁", "🍭"].includes(e)) {
      noiseHit(ctx, master, now, 0.055, 0.32, "bandpass", 850, 1.2);
      pulse(ctx, master, now + 0.05, 880, 0.28, 0.08);
    } else if (["👻", "💀", "🤖", "👽"].includes(e)) {
      const robotic = ["🤖", "👽"].includes(e);
      vocal(ctx, master, now, robotic ? 160 : 420, robotic ? 85 : 220, 0.5, 0.16, robotic ? [500, 1500] : [800, 1700]);
      if (robotic) pulse(ctx, master, now + 0.02, 80, 0.42, 0.08, "square");
    } else if (["❄", "❄️", "🌸", "🌺", "🌻", "🌈", "🍀", "🦋", "☀", "☀️"].includes(e)) {
      sparkle(ctx, master, now, [1047, 1319, 1568], 0.085);
    } else if (["😊", "🥹", "😇", "🤭"].includes(e)) {
      vocal(ctx, master, now, 280, 335, 0.22, 0.11, [690, 1320]);
      sparkle(ctx, master, now + 0.12, [659, 880], 0.06);
    } else {
      pulse(ctx, master, now, 640, 0.18, 0.09);
      pulse(ctx, master, now + 0.07, 960, 0.18, 0.055);
    }
  } catch {
    // Audio is best-effort; browser autoplay or device errors should not block reactions.
  }
}
