import { X } from "lucide-react";

export type VoiceEffectType = "none" | "robot" | "echo" | "reverb" | "deep";

interface VoiceEffectsPanelProps {
  currentEffect: VoiceEffectType;
  t: (key: string) => string;
  onSelect: (effect: VoiceEffectType) => void;
  onClose: () => void;
  disabled?: boolean;
}

const EFFECTS: { id: VoiceEffectType; emoji: string; labelKey: string }[] = [
  { id: "none",   emoji: "🎙️", labelKey: "vroom.effectNone"   },
  { id: "robot",  emoji: "🤖", labelKey: "vroom.effectRobot"  },
  { id: "echo",   emoji: "🌊", labelKey: "vroom.effectEcho"   },
  { id: "reverb", emoji: "🏛️", labelKey: "vroom.effectReverb" },
  { id: "deep",   emoji: "🔊", labelKey: "vroom.effectDeep"   },
];

export function VoiceEffectsPanel({ currentEffect, t, onSelect, onClose, disabled }: VoiceEffectsPanelProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">✨ {t("vroom.voiceEffects")}</span>
        <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {EFFECTS.map((effect) => (
          <button
            key={effect.id}
            disabled={disabled}
            onClick={() => onSelect(effect.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              currentEffect === effect.id
                ? "border-primary bg-primary/10 text-primary font-semibold"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <span>{effect.emoji}</span>
            <span>{t(effect.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
