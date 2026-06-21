/**
 * Visionex Reaction Audio Engine v4 — Real Human Recordings
 *
 * Complete replacement of synthesis engine. Every reaction now uses
 * professionally recorded audio sourced from verified public-domain archives
 * (Internet Archive / Red Library USC Cinema Collection).
 *
 * Audio files live in /public/audio/reactions/
 *
 * Public API (backward-compatible with v3):
 *   playReactionSound(emoji)         — trigger a reaction sound
 *   setVoiceSpeakingState(speaking)  — feed voice-activity detection for ducking
 *   preloadReactionSounds()          — warm up all buffers on room join
 *   disposeReactionSounds()          — release resources on room leave
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const MASTER_LVL   = 0.88;   // overall output level
const DUCK_TARGET  = 0.20;   // fraction of master during active speech
const DUCK_RAMP    = 0.18;   // seconds to duck down
const UNDUCK_RAMP  = 0.70;   // seconds to recover after speech
const MIN_GAP_MS   = 80;     // minimum ms between reaction triggers (anti-spam)
const FADE_IN_S    = 0.010;  // 10 ms click-prevention fade-in
const FADE_OUT_S   = 0.35;   // 350 ms natural tail fade-out

// ─── Clip Manifest ────────────────────────────────────────────────────────────
//
// Each Clip can have:
//   gain        — perceived-loudness normalizer (all clips should feel equal)
//   trimStart   — skip leading silence / intro (seconds)
//   playDuration — how long to play before fading out; undefined = full length
//
// Multiple clips per category enable random variation so the same reaction
// never sounds identical twice.

interface Clip {
  path: string;
  gain: number;
  trimStart?: number;
  playDuration?: number;
}

const CLIPS = {

  // 👏  Large audience applause — multiple real crowd variants
  applause: [
    { path: '/audio/reactions/applause-01.mp3', gain: 0.90, playDuration: 4.0 },
    { path: '/audio/reactions/applause-02.mp3', gain: 0.95, playDuration: 3.5 },
    { path: '/audio/reactions/applause-03.mp3', gain: 0.80, trimStart: 0.3, playDuration: 4.0 },
  ],

  // 😂  Real group laughter with natural breathing and different voices
  laugh: [
    { path: '/audio/reactions/laugh-01.mp3', gain: 1.00, playDuration: 5.0 },
    { path: '/audio/reactions/laugh-02.mp3', gain: 0.90, trimStart: 0.2, playDuration: 4.5 },
  ],

  // 🎉  Crowd cheering — audience at sporting event, whistles, energy
  cheer: [
    { path: '/audio/reactions/cheer-01.mp3', gain: 0.92, trimStart: 0.4, playDuration: 4.0 },
    { path: '/audio/reactions/cheer-02.mp3', gain: 0.88, playDuration: 3.5 },
  ],

  // 🎊  Celebration — whistling, cheering, crowd energy
  celebration: [
    { path: '/audio/reactions/celebration-01.mp3', gain: 0.90, trimStart: 0.3, playDuration: 4.5 },
    { path: '/audio/reactions/celebration-02.mp3', gain: 0.85, playDuration: 3.5 },
  ],

  // ❤️  Real heartbeat — medical-quality recording, natural rhythm
  heartbeat: [
    { path: '/audio/reactions/heartbeat-01.mp3', gain: 1.10, playDuration: 6.0 },
  ],

  // 🔥  Real fire — crackling campfire, natural combustion sounds
  fire: [
    { path: '/audio/reactions/fire-01.mp3', gain: 0.85, playDuration: 3.0 },
    { path: '/audio/reactions/fire-02.mp3', gain: 0.78, trimStart: 0.5, playDuration: 3.5 },
  ],

  // 😲  Real crowd gasp / surprise reaction — collective human response
  gasp: [
    { path: '/audio/reactions/gasp-01.mp3', gain: 0.88, trimStart: 0.3, playDuration: 3.0 },
    { path: '/audio/reactions/gasp-02.mp3', gain: 0.82, trimStart: 0.5, playDuration: 3.0 },
  ],

  // 👍  Light crowd approval — sparse cheers, positive burst
  approval: [
    { path: '/audio/reactions/approval-01.mp3', gain: 0.90, trimStart: 0.2, playDuration: 3.5 },
    { path: '/audio/reactions/approval-02.mp3', gain: 0.85, playDuration: 3.0 },
  ],

  // ❤️‍🔥  Soft crowd murmur — gentle group appreciation, intimate "awww"
  crowd: [
    { path: '/audio/reactions/crowd-01.mp3', gain: 0.72, playDuration: 3.5 },
  ],

} as const;

type Category = keyof typeof CLIPS;

// ─── Emoji → Category Map ─────────────────────────────────────────────────────

const EMOJI_CAT: Record<string, Category> = {};

function reg(cat: Category, ...emojis: string[]): void {
  emojis.forEach(e => { EMOJI_CAT[e] = cat; });
}

// Applause
reg('applause',
  '👏', '🙌', '🤲',
);

// Laugh
reg('laugh',
  '😂', '😆', '😅', '🤣', '😁', '😄', '😃',
  '🤪', '😜', '😝', '🤭', '😬',
);

// Heartbeat — close, intimate love sounds
reg('heartbeat',
  '❤️', '❤', '💓', '💗', '💖', '💝', '🫶', '💑',
);

// Soft crowd appreciation — "awww", warmth, gentle reactions
reg('crowd',
  '🥰', '😍', '💕', '💞', '🫂',
  '⭐', '🌟', '💫', '✨', '🌈', '☀️', '🌙', '❄️', '🍀',
  '🌸', '🌺', '🌻', '🦋', '💡',
  '💎', '👑', '🏅', '💍',
);

// Fire / explosion
reg('fire',
  '🔥', '💥', '🌋',
);

// Celebration — big energy crowd
reg('celebration',
  '🎉', '🎊', '🥳', '🎈', '🎆', '🎇', '🧨',
  '🏆', '💯', '🥇', '🎯', '🎖️', '🎖',
  '🎵', '🎶', '🎸', '🎮', '🎤', '📣', '📢',
  '🏳️', '🚩', '🎺', '🥁', '🎻',
);

// Surprise / shock — crowd gasp
reg('gasp',
  '😮', '🤯', '😳', '🫣', '😲', '🫢', '😱', '🙀',
);

// Sad / emotional — subdued crowd gasp / exhale
reg('gasp',
  '😢', '😭', '🥺', '😥', '💔', '🥲',
);

// Approval — light cheers, positive burst
reg('approval',
  '👍', '👍🏼', '👍🏽', '👍🏾', '👍🏿',
  '💪', '🤙', '✌️', '✌', '👋', '🙋',
  '🤜', '🤛', '🤞', '👌', '🤌', '🫵',
  '🙏', '😎', '🤩', '😏',
);

// Cheer — big crowd energy
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

  // Fade in → sustain → fade out
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
