/**
 * PremiumReactions — High-quality reaction system for Voice Rooms.
 *
 * Exports:
 *   PremiumFloatingReaction  — type for floating reaction state
 *   createFloatingReaction   — factory with random animation params
 *   FloatingReactionsOverlay — renders floating emojis over the room
 *   PremiumReactionBar       — glassmorphism reaction bar with picker
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PremiumFloatingReaction {
  id: string;
  emoji: string;
  /** % from left edge of overlay (5–87) */
  x: number;
  /** horizontal drift in px — negative = left, positive = right */
  drift: number;
  /** total animation duration in ms */
  speed: number;
  /** font-size in rem */
  size: number;
  /** rgba CSS color for the glow filter */
  glow: string;
}

// ── Emoji Glow Palette ────────────────────────────────────────────────────

const GLOW: Record<string, string> = {
  "👍":  "rgba(250,204,21,0.75)",
  "❤️":  "rgba(239,68,68,0.8)",
  "😂":  "rgba(250,204,21,0.65)",
  "😮":  "rgba(251,146,60,0.75)",
  "👏":  "rgba(250,204,21,0.65)",
  "🔥":  "rgba(249,115,22,0.9)",
  "💯":  "rgba(239,68,68,0.7)",
  "⭐":  "rgba(250,204,21,0.85)",
  "🌟":  "rgba(250,204,21,0.9)",
  "✨":  "rgba(196,181,253,0.8)",
  "💫":  "rgba(196,181,253,0.75)",
  "🎉":  "rgba(167,139,250,0.8)",
  "🎊":  "rgba(167,139,250,0.75)",
  "🚀":  "rgba(96,165,250,0.8)",
  "💎":  "rgba(96,165,250,0.9)",
  "🏆":  "rgba(250,204,21,0.9)",
  "🥇":  "rgba(250,204,21,0.9)",
  "💥":  "rgba(249,115,22,0.9)",
  "❄️":  "rgba(147,197,253,0.8)",
  "🌈":  "rgba(167,139,250,0.65)",
  "⚡":  "rgba(250,204,21,0.95)",
  "🌙":  "rgba(196,181,253,0.75)",
  "☀️":  "rgba(251,191,36,0.95)",
  "🎵":  "rgba(167,139,250,0.7)",
  "🎶":  "rgba(167,139,250,0.7)",
  "💪":  "rgba(250,204,21,0.7)",
  "🙌":  "rgba(250,204,21,0.65)",
  "🙏":  "rgba(250,204,21,0.65)",
  "👑":  "rgba(250,204,21,0.95)",
  "🎯":  "rgba(239,68,68,0.8)",
  "💡":  "rgba(250,204,21,0.85)",
};

function getGlow(emoji: string) {
  return GLOW[emoji] ?? "rgba(255,255,255,0.55)";
}

// ── Particle Color Palettes ───────────────────────────────────────────────

const PARTICLES: Record<string, string[]> = {
  "👍":  ["#facc15","#fbbf24","#fde68a"],
  "❤️":  ["#ef4444","#f87171","#fca5a5","#fecaca"],
  "😂":  ["#facc15","#fde047","#fef08a","#fef9c3"],
  "🔥":  ["#f97316","#fb923c","#fcd34d","#fef3c7"],
  "🎉":  ["#a78bfa","#c084fc","#f9a8d4","#facc15","#86efac"],
  "🚀":  ["#60a5fa","#818cf8","#a5b4fc","#c7d2fe"],
  "💎":  ["#60a5fa","#93c5fd","#bfdbfe","#e0f2fe"],
  "✨":  ["#c4b5fd","#ddd6fe","#f3e8ff","#ffffff"],
  "🌟":  ["#fde047","#facc15","#fbbf24","#fcd34d"],
  "⭐":  ["#fde047","#facc15","#fef08a"],
  "💥":  ["#f97316","#ef4444","#fde047","#fca5a5"],
  "💯":  ["#ef4444","#f87171","#fecaca"],
  "🏆":  ["#facc15","#f59e0b","#fbbf24"],
  "❄️":  ["#93c5fd","#bfdbfe","#e0f2fe","#ffffff"],
  "⚡":  ["#fde047","#facc15","#fff9c4"],
  "🎉":  ["#a78bfa","#c084fc","#facc15","#86efac","#f9a8d4"],
  "🎊":  ["#a78bfa","#c084fc","#f0abfc","#facc15"],
  "👑":  ["#facc15","#f59e0b","#fde047","#ffffff"],
};

function getParticleColors(emoji: string) {
  return PARTICLES[emoji] ?? ["#ffffff","#f1f5f9","#e2e8f0"];
}

// ── CSS (injected once) ────────────────────────────────────────────────────

const CSS_ID = "pr-premium-reactions-css";

const INJECTED_CSS = `
@keyframes pr-float-up {
  0%   { transform: translateY(0) translateX(0) scale(0) rotate(-10deg); opacity: 0; }
  5%   { transform: translateY(-12px) translateX(0) scale(1.5) rotate(5deg); opacity: 1; }
  12%  { transform: translateY(-26px) translateX(calc(var(--pr-drift) * 0.08)) scale(1) rotate(0deg); opacity: 1; }
  38%  { transform: translateY(-105px) translateX(calc(var(--pr-drift) * 0.5)); opacity: 0.88; }
  63%  { transform: translateY(-195px) translateX(calc(var(--pr-drift) * 0.85)); opacity: 0.52; }
  82%  { transform: translateY(-265px) translateX(var(--pr-drift)); opacity: 0.22; }
  100% { transform: translateY(-330px) translateX(calc(var(--pr-drift) * 0.6)); opacity: 0; }
}

@keyframes pr-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px var(--pr-glow)) drop-shadow(0 2px 8px rgba(0,0,0,0.55)); }
  50%       { filter: drop-shadow(0 0 13px var(--pr-glow)) drop-shadow(0 2px 12px rgba(0,0,0,0.65)); }
}

@keyframes pr-particle-burst {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  65%  { transform: translate(var(--pr-px),var(--pr-py)) scale(0.45); opacity: 0.6; }
  100% { transform: translate(calc(var(--pr-px)*1.4),calc(var(--pr-py)*1.4)) scale(0); opacity: 0; }
}

@keyframes pr-ripple-expand {
  0%   { transform: scale(0.35); opacity: 0.9; }
  100% { transform: scale(2.9); opacity: 0; }
}

@keyframes pr-btn-pop {
  0%   { transform: scale(1); }
  22%  { transform: scale(0.8); }
  58%  { transform: scale(1.28); }
  80%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.pr-floating-emoji {
  position: absolute;
  bottom: 16px;
  user-select: none;
  pointer-events: none;
  will-change: transform, opacity;
  line-height: 1;
  animation-name: pr-float-up;
  animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
  animation-fill-mode: forwards;
}

.pr-floating-emoji-inner {
  display: block;
  animation: pr-glow-pulse 1.5s ease-in-out infinite;
}

.pr-burst-particle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, opacity;
  animation-name: pr-particle-burst;
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}

.pr-burst-ripple {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  animation: pr-ripple-expand 0.52s ease-out forwards;
}

.pr-btn-pop {
  animation: pr-btn-pop 0.44s cubic-bezier(0.34,1.56,0.64,1) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .pr-floating-emoji,
  .pr-floating-emoji-inner,
  .pr-burst-particle,
  .pr-burst-ripple,
  .pr-btn-pop {
    animation: none !important;
    transition: none !important;
  }
}
`;

function ensureCSS() {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = INJECTED_CSS;
  document.head.appendChild(s);
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createFloatingReaction(emoji: string): PremiumFloatingReaction {
  return {
    id: Math.random().toString(36).slice(2),
    emoji,
    x:     5 + Math.random() * 82,
    drift: (Math.random() - 0.5) * 130,
    speed: 2500 + Math.random() * 900,
    size:  2.2 + Math.random() * 1.1,
    glow:  getGlow(emoji),
  };
}

// ── FloatingEmoji ──────────────────────────────────────────────────────────

function FloatingEmoji({ r }: { r: PremiumFloatingReaction }) {
  return (
    <div
      className="pr-floating-emoji"
      style={{
        left: `${r.x}%`,
        fontSize: `${r.size}rem`,
        animationDuration: `${r.speed}ms`,
        "--pr-drift": `${r.drift}px`,
        "--pr-glow": r.glow,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span
        className="pr-floating-emoji-inner"
        style={{ "--pr-glow": r.glow } as React.CSSProperties}
      >
        {r.emoji}
      </span>
    </div>
  );
}

// ── FloatingReactionsOverlay ───────────────────────────────────────────────

interface FloatingReactionsOverlayProps {
  reactions: PremiumFloatingReaction[];
}

export function FloatingReactionsOverlay({ reactions }: FloatingReactionsOverlayProps) {
  useEffect(() => { ensureCSS(); }, []);
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {reactions.map((r) => <FloatingEmoji key={r.id} r={r} />)}
    </div>
  );
}

// ── BurstParticles ─────────────────────────────────────────────────────────

function BurstParticles({ emoji }: { emoji: string }) {
  const colors = getParticleColors(emoji);

  const particlesRef = useRef<Array<{
    px: number; py: number; size: number; color: string; dur: number;
  }>>();

  if (!particlesRef.current) {
    const N = 9;
    particlesRef.current = Array.from({ length: N }, (_, i) => {
      const angle  = (i / N) * 360 + (Math.random() * 22 - 11);
      const dist   = 22 + Math.random() * 30;
      const rad    = (angle * Math.PI) / 180;
      return {
        px:    Math.cos(rad) * dist,
        py:    Math.sin(rad) * dist,
        size:  3 + Math.random() * 4.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        dur:   370 + Math.random() * 230,
      };
    });
  }

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ overflow: "visible" }}
    >
      {particlesRef.current.map((p, i) => (
        <div
          key={i}
          className="pr-burst-particle"
          style={{
            left:        "50%",
            top:         "50%",
            width:       p.size,
            height:      p.size,
            background:  p.color,
            marginLeft:  -(p.size / 2),
            marginTop:   -(p.size / 2),
            boxShadow:   `0 0 ${p.size + 1}px ${p.color}90`,
            animationDuration: `${p.dur}ms`,
            "--pr-px": `${p.px}px`,
            "--pr-py": `${p.py}px`,
          } as React.CSSProperties}
        />
      ))}
      <div
        className="pr-burst-ripple"
        style={{
          left:      "50%",
          top:       "50%",
          width:     30,
          height:    30,
          marginLeft:-15,
          marginTop: -15,
          border:    `1.5px solid ${colors[0]}`,
          boxShadow: `0 0 6px ${colors[0]}70`,
        }}
      />
    </div>
  );
}

// ── ReactionButton ─────────────────────────────────────────────────────────

interface ReactionButtonProps {
  emoji: string;
  onSend: (emoji: string) => void;
  large?: boolean;
}

function ReactionButton({ emoji, onSend, large }: ReactionButtonProps) {
  const btnRef       = useRef<HTMLButtonElement>(null);
  const [burst, setBurst] = useState(false);
  const glow         = getGlow(emoji);

  const handleClick = useCallback(() => {
    // Burst particles
    setBurst(false);
    requestAnimationFrame(() => {
      setBurst(true);
      setTimeout(() => setBurst(false), 720);
    });
    // Pop animation
    if (btnRef.current) {
      btnRef.current.classList.remove("pr-btn-pop");
      void btnRef.current.offsetWidth;
      btnRef.current.classList.add("pr-btn-pop");
    }
    onSend(emoji);
  }, [emoji, onSend]);

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      aria-label={emoji}
      className="group relative flex items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      style={{ padding: large ? "0.38rem 0.42rem" : "0.28rem 0.32rem" }}
    >
      {/* Radial glow backdrop (hover) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 65%, ${glow.replace(/[\d.]+\)$/, "0.28)")} 0%, transparent 72%)`,
          transform: "scale(1.55)",
          filter: "blur(3px)",
        }}
      />
      {/* Particles */}
      {burst && <BurstParticles emoji={emoji} />}
      {/* Emoji face */}
      <span
        aria-hidden="true"
        className="relative block select-none leading-none transition-transform duration-150 group-hover:scale-[1.28] group-active:scale-90"
        style={{
          fontSize: large ? "1.6rem" : "1.45rem",
          filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.5))",
          transition: "filter 0.15s ease, transform 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.filter =
            `drop-shadow(0 0 9px ${glow}) drop-shadow(0 1px 4px rgba(0,0,0,0.55))`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.filter =
            "drop-shadow(0 1px 4px rgba(0,0,0,0.5))";
        }}
      >
        {emoji}
      </span>
    </button>
  );
}

// ── PremiumReactionBar ─────────────────────────────────────────────────────

export interface PremiumReactionBarProps {
  coreReactions: string[];
  extraEmojis: string[];
  onSendReaction: (emoji: string) => void;
  moreAriaLabel?: string;
}

export function PremiumReactionBar({
  coreReactions,
  extraEmojis,
  onSendReaction,
  moreAriaLabel = "More reactions",
}: PremiumReactionBarProps) {
  useEffect(() => { ensureCSS(); }, []);
  const [showPicker, setShowPicker] = useState(false);

  const handleSend = useCallback((emoji: string) => {
    onSendReaction(emoji);
    setShowPicker(false);
  }, [onSendReaction]);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Expanded picker ── */}
      {showPicker && (
        <div
          className="rounded-2xl border border-white/10 bg-black/55 p-3 shadow-2xl backdrop-blur-xl"
          style={{
            boxShadow:
              "0 8px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
            {extraEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSend(emoji)}
                aria-label={emoji}
                className="group relative rounded-xl p-1.5 text-xl leading-none transition-all duration-150 hover:bg-white/10 active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
              >
                <span
                  className="block leading-none transition-transform duration-150 group-hover:scale-[1.25]"
                  style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.filter =
                      `drop-shadow(0 0 7px ${getGlow(emoji)}) drop-shadow(0 1px 3px rgba(0,0,0,0.5))`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.filter =
                      "drop-shadow(0 1px 3px rgba(0,0,0,0.5))";
                  }}
                >
                  {emoji}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Core reactions bar ── */}
      <div
        className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {coreReactions.map((emoji) => (
          <ReactionButton key={emoji} emoji={emoji} onSend={onSendReaction} large />
        ))}

        <span
          className="mx-1 h-6 w-px rounded-full bg-white/15"
          aria-hidden="true"
        />

        {/* More reactions toggle */}
        <button
          onClick={() => setShowPicker((v) => !v)}
          aria-label={moreAriaLabel}
          aria-expanded={showPicker}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
            showPicker
              ? "border-primary/60 bg-primary/20 text-primary shadow-[0_0_14px_rgba(139,92,246,0.35)]"
              : "border-white/15 bg-white/5 text-white/60 hover:border-white/25 hover:bg-white/10 hover:text-white/90"
          }`}
        >
          <span className="block text-base leading-none">😀</span>
          {showPicker
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronUp className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
