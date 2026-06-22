/**
 * Visionex Reaction Audio Engine v5 — Duration & Emotion Refinement Pass
 *
 * Changes from v4:
 *   • All playDuration values cut to 0.45–1.8 s (was 3–6 s) — instant feel
 *   • trimStart tuned per-file to jump straight to the peak moment
 *   • FADE_OUT_S reduced 350 ms → 150 ms (no unnecessary tail)
 *   • Sad/cry emojis (😢😭🥺) moved off 'gasp' → 'crowd' (soft sympathetic murmur)
 *   • Anger emojis (😡😤😠) added → 'gasp' category (reactive, sharp intake)
 *   • heartbeat gain reduced 1.10 → 0.80 (was the loudest, should be softest)
 *   • New 'sad' virtual sub-category via crowd clips at reduced gain
 *   • MIN_GAP_MS reduced 80 → 60 for snappier multi-tap feel
 *
 * Audio files live in /public/audio/reactions/
 *
 * Public API (unchanged):
 *   playReactionSound(emoji)
 *   setVoiceSpeakingState(speaking)
 *   preloadReactionSounds()
 *   disposeReactionSounds()
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MASTER_LVL   = 0.88;   // overall output level
const DUCK_TARGET  = 0.20;   // fraction of master during active speech
const DUCK_RAMP    = 0.18;   // seconds to duck down
const UNDUCK_RAMP  = 0.70;   // seconds to recover after speech
const MIN_GAP_MS   = 60;     // min ms between reaction triggers (was 80)
const FADE_IN_S    = 0.008;  // 8 ms click-prevention fade-in
const FADE_OUT_S   = 0.15;   // 150 ms tail (was 350 ms — now crisp)

// ─── Clip Manifest ────────────────────────────────────────────────────────────
//
// Duration targets (v5):
//   gasp        0.45 s  — sharp, immediate, over instantly
//   fire        0.55 s  — crackling onset only
//   approval    0.60 s  — brief positive burst
//   laugh       0.65 s  — peak of the group laughter
//   crowd-sad   0.65 s  — soft sympathetic murmur
//   crowd       0.70 s  — gentle warm appreciation
//   cheer       0.80 s  — crowd energy peak
//   applause    0.80 s  — burst of clapping
//   celebration 0.88 s  — cheer climax
//   heartbeat   1.80 s  — exactly 2 heartbeat cycles (natural rhythm)
//
// trimStart: jumps past room tone / silence to the actual peak moment.

interface Clip {
  path: string;
  gain: number;
  trimStart?: number;
  playDuration?: number;
}

const CLIPS = {

  // 👏  Large audience applause — burst only, not the whole crowd
  applause: [
    { path: '/audio/reactions/applause-01.mp3', gain: 0.88, trimStart: 0.40, playDuration: 0.80 },
    { path: '/audio/reactions/applause-02.mp3', gain: 0.92, trimStart: 0.25, playDuration: 0.80 },
    { path: '/audio/reactions/applause-03.mp3', gain: 0.82, trimStart: 0.55, playDuration: 0.80 },
  ],

  // 😂  Real group laughter — just the peak, warm and natural
  laugh: [
    { path: '/audio/reactions/laugh-01.mp3', gain: 0.92, trimStart: 0.35, playDuration: 0.65 },
    { path: '/audio/reactions/laugh-02.mp3', gain: 0.85, trimStart: 0.50, playDuration: 0.65 },
  ],

  // 🎉  Crowd cheering — the cheer peak, not the full crowd arc
  cheer: [
    { path: '/audio/reactions/cheer-01.mp3', gain: 0.90, trimStart: 0.60, playDuration: 0.80 },
    { path: '/audio/reactions/cheer-02.mp3', gain: 0.85, trimStart: 0.35, playDuration: 0.80 },
  ],

  // 🎊  Celebration — crowd climax moment only
  celebration: [
    { path: '/audio/reactions/celebration-01.mp3', gain: 0.88, trimStart: 0.50, playDuration: 0.88 },
    { path: '/audio/reactions/celebration-02.mp3', gain: 0.82, trimStart: 0.30, playDuration: 0.88 },
  ],

  // ❤️  Real heartbeat — exactly 2 beats, then done
  //     Gain reduced to 0.80 (was 1.10) — heartbeats should be intimate, not loud
  heartbeat: [
    { path: '/audio/reactions/heartbeat-01.mp3', gain: 0.80, trimStart: 0.10, playDuration: 1.80 },
  ],

  // 🔥  Crackling fire onset — just the initial burst
  fire: [
    { path: '/audio/reactions/fire-01.mp3', gain: 0.82, trimStart: 0.20, playDuration: 0.55 },
    { path: '/audio/reactions/fire-02.mp3', gain: 0.75, trimStart: 0.60, playDuration: 0.55 },
  ],

  // 😮  Sharp crowd gasp — quick collective intake of breath
  //     Also used for 😡 anger (reactive, sharp, startled quality)
  gasp: [
    { path: '/audio/reactions/gasp-01.mp3', gain: 0.85, trimStart: 0.40, playDuration: 0.45 },
    { path: '/audio/reactions/gasp-02.mp3', gain: 0.80, trimStart: 0.60, playDuration: 0.45 },
  ],

  // 👍  Brief positive crowd burst — "yes!" energy
  approval: [
    { path: '/audio/reactions/approval-01.mp3', gain: 0.88, trimStart: 0.30, playDuration: 0.60 },
    { path: '/audio/reactions/approval-02.mp3', gain: 0.82, trimStart: 0.20, playDuration: 0.60 },
  ],

  // 🥰  Soft crowd appreciation — gentle group "aww" / warm murmur
  crowd: [
    { path: '/audio/reactions/crowd-01.mp3', gain: 0.72, trimStart: 0.25, playDuration: 0.70 },
  ],

  // 😢  Sad / emotional — same crowd recording at even lower gain
  //     Sounds like a sympathetic collective exhale rather than a shock gasp.
  //     (Previously wrongly mapped to 'gasp' — surprise ≠ sadness)
  sad: [
    { path: '/audio/reactions/crowd-01.mp3', gain: 0.52, trimStart: 0.20, playDuration: 0.65 },
  ],

} as const;

type Category = keyof typeof CLIPS;

// ─── Emoji → Category Map ─────────────────────────────────────────────────────

const EMOJI_CAT: Record<string, Category> = {};

function reg(cat: Category, ...emojis: string[]): void {
  emojis.forEach(e => { EMOJI_CAT[e] = cat; });
}

// Applause — clapping, hands, standing ovation energy
reg('applause',
  '👏', '🙌', '🤲',
);

// Laugh — genuine amusement, humor
reg('laugh',
  '😂', '😆', '😅', '🤣', '😁', '😄', '😃',
  '🤪', '😜', '😝', '🤭', '😬',
);

// Heartbeat — close, intimate love (2 beats, soft volume)
reg('heartbeat',
  '❤️', '❤', '💓', '💗', '💖', '💝', '🫶', '💑',
);

// Sad / cry / heartbreak — soft sympathetic crowd murmur
// (previously wrongly on 'gasp' — surprise and sadness are opposite emotions)
reg('sad',
  '😢', '😭', '🥺', '😥', '🥲', '💔',
);

// Crowd warmth — soft appreciation, "awww", admiration
reg('crowd',
  '🥰', '😍', '💕', '💞', '🫂',
  '⭐', '🌟', '💫', '✨', '🌈', '☀️', '🌙', '❄️', '🍀',
  '🌸', '🌺', '🌻', '🦋', '💡',
  '💎', '👑', '🏅', '💍',
);

// Fire — energy, heat, excitement burst
reg('fire',
  '🔥', '💥', '🌋',
);

// Celebration — big crowd energy, achievement
reg('celebration',
  '🎉', '🎊', '🥳', '🎈', '🎆', '🎇', '🧨',
  '🏆', '💯', '🥇', '🎯', '🎖️', '🎖',
  '🎵', '🎶', '🎸', '🎮', '🎤', '📣', '📢',
  '🏳️', '🚩', '🎺', '🥁', '🎻',
);

// Gasp / surprise — sharp collective inhale
reg('gasp',
  '😮', '🤯', '😳', '🫣', '😲', '🫢', '😱', '🙀',
);

// Anger / frustration — reactive, sharp quality of gasp suits frustration
// (best available audio without a dedicated anger recording)
reg('gasp',
  '😡', '😤', '😠', '🤬',
);

// Approval — light positive burst
reg('approval',
  '👍', '👍🏼', '👍🏽', '👍🏾', '👍🏿',
  '💪', '🤙', '✌️', '✌', '👋', '🙋',
  '🤜', '🤛', '🤞', '👌', '🤌', '🫵',
  '🙏', '😎', '🤩', '😏',
);

// Cheer — big crowd energy, momentum
reg('cheer',
  '🚀', '🛸', '✈️', '✈', '⚽', '🏀',
  '⚡', '🌩️', '🌩', '🔋',
);

// ─── Singleton State ──────────────────────────────────────────────────────────

let _ctx:       AudioContext | null = null;
let _master:    GainNode     | null = null;
const _buffers  = new Map<string, AudioBuffer>();
const _promises = new Map<string, Promise<AudioBuffer | null>>();
const _variants = new Map<Category, number>();
let _lastPlay   = 0;
let _isDucking  = false;

// ─── Context Initialization ───────────────────────────────────────────────────

function acquireCtx(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new Ctor({ latencyHint: 'interactive' });
    }
    if (_ctx.state === 'suspended') void _ctx.resume();
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

// ─── Buffer Loading ───────────────────────────────────────────────────────────

function fetchBuffer(path: string, ac: AudioContext): Promise<AudioBuffer | null> {
  if (_buffers.has(path)) return Promise.resolve(_buffers.get(path)!);
  if (_promises.has(path)) return _promises.get(path)!;

  const p: Promise<AudioBuffer | null> = (async () => {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(raw);
      _buffers.set(path, buf);
      return buf;
    } catch {
      return null;
    }
  })();

  _promises.set(path, p);
  return p;
}

// ─── Playback ─────────────────────────────────────────────────────────────────

function scheduleClip(
  ac: AudioContext,
  buf: AudioBuffer,
  clipGain: number,
  trimStart = 0,
  playDuration?: number,
): void {
  if (!_master) return;

  const src        = ac.createBufferSource();
  src.buffer       = buf;

  const available  = buf.duration - trimStart;
  const actualDur  = playDuration !== undefined
    ? Math.min(playDuration, available)
    : available;

  const gainNode   = ac.createGain();
  const t          = ac.currentTime;

  // Fade in (8 ms) → sustain → fade out (150 ms)
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(clipGain, t + FADE_IN_S);
  const fadeStart = t + Math.max(FADE_IN_S + 0.001, actualDur - FADE_OUT_S);
  gainNode.gain.setValueAtTime(clipGain, fadeStart);
  gainNode.gain.linearRampToValueAtTime(0, t + actualDur);

  src.connect(gainNode);
  gainNode.connect(_master);
  src.start(t, trimStart, actualDur);
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

function cleanEmoji(emoji: string): string {
  return Array.from(emoji)
    .filter(c => { const cp = c.codePointAt(0) ?? 0; return cp < 0x1f3fb || cp > 0x1f3ff; })
    .join('')
    .replace(/️/g, '')  // strip variation selectors
    .replace(/‍/g, ''); // strip ZWJ characters
}

export function playReactionSound(emoji: string): void {
  const now = Date.now();
  if (now - _lastPlay < MIN_GAP_MS) return;
  _lastPlay = now;

  try {
    const ac = acquireCtx();
    if (!ac) return;

    const key = cleanEmoji(emoji);
    const cat: Category | undefined = EMOJI_CAT[key] ?? EMOJI_CAT[emoji];
    if (!cat) return;

    const clips = CLIPS[cat] as readonly Clip[];
    if (!clips.length) return;

    // Cycle variants so no two consecutive reactions use the same clip
    const idx  = (_variants.get(cat) ?? 0) % clips.length;
    _variants.set(cat, idx + 1);
    const clip = clips[idx];

    const cached = _buffers.get(clip.path);
    if (cached) {
      scheduleClip(ac, cached, clip.gain, clip.trimStart, clip.playDuration);
    } else {
      fetchBuffer(clip.path, ac).then(buf => {
        if (buf) scheduleClip(ac, buf, clip.gain, clip.trimStart, clip.playDuration);
      });
    }
  } catch {
    // Audio is best-effort — never block the reaction UI
  }
}

/** Decode and cache all audio files in the background on room join. */
export function preloadReactionSounds(): void {
  const ac = acquireCtx();
  if (!ac) return;

  const paths = new Set<string>();
  for (const clips of Object.values(CLIPS)) {
    for (const clip of (clips as readonly Clip[])) paths.add(clip.path);
  }
  for (const path of paths) void fetchBuffer(path, ac);
}

/** Release the AudioContext and all cached buffers on room leave. */
export function disposeReactionSounds(): void {
  try {
    if (_ctx && _ctx.state !== 'closed') void _ctx.close();
  } catch {
    // ignore
  } finally {
    _ctx    = null;
    _master = null;
    _buffers.clear();
    _promises.clear();
    _variants.clear();
    _isDucking = false;
  }
}
