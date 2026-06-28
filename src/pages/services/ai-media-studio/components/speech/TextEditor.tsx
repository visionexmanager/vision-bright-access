import { useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MAX_CHARS = 4096;
const WORDS_PER_MIN = 150;

function estimateDuration(text: string, speed: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return "0s";
  const totalSeconds = Math.round((words / WORDS_PER_MIN) * 60 / Math.max(0.25, speed));
  if (totalSeconds < 60) return `~${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return s ? `~${m}m ${s}s` : `~${m}m`;
}

const LS_KEY = "ams_speech_draft";

interface TextEditorProps {
  value: string;
  onChange: (v: string) => void;
  speed: number;
  disabled?: boolean;
}

export function TextEditor({ value, onChange, speed, disabled = false }: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (!value) {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) onChange(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save with 500ms debounce
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value.slice(0, MAX_CHARS);
      onChange(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localStorage.setItem(LS_KEY, next);
      }, 500);
    },
    [onChange]
  );

  // Cleanup timer
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const charCount  = value.length;
  const wordCount  = value.trim().split(/\s+/).filter(Boolean).length;
  const charPct    = charCount / MAX_CHARS;
  const isNearLimit = charPct > 0.8;
  const atLimit    = charPct >= 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Enter your text here… OpenAI TTS supports over 50 languages. Just type naturally."
          rows={10}
          aria-label="Speech text input"
          aria-describedby="text-editor-stats"
          className={cn(
            "w-full resize-y rounded-xl border bg-background p-4 text-sm leading-relaxed",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "placeholder:text-muted-foreground/50 transition-colors",
            "min-h-[200px] max-h-[600px]",
            disabled && "opacity-60 cursor-not-allowed",
            atLimit && "border-destructive focus:ring-destructive/50"
          )}
        />
        {/* Character progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-border">
          <div
            className={cn(
              "h-full transition-all duration-300",
              atLimit   ? "bg-destructive" :
              isNearLimit ? "bg-amber-500" : "bg-primary/40"
            )}
            style={{ width: `${Math.min(100, charPct * 100)}%` }}
            role="progressbar"
            aria-valuenow={charCount}
            aria-valuemax={MAX_CHARS}
            aria-label="Character usage"
          />
        </div>
      </div>

      <div
        id="text-editor-stats"
        className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground px-1"
      >
        <span>
          <span className={cn("font-medium tabular-nums", atLimit && "text-destructive")}>
            {charCount.toLocaleString()}
          </span>
          <span>/{MAX_CHARS.toLocaleString()} chars</span>
        </span>
        <span className="text-border">·</span>
        <span>
          <span className="font-medium tabular-nums">{wordCount.toLocaleString()}</span> words
        </span>
        <span className="text-border">·</span>
        <span className="font-medium">{estimateDuration(value, speed)}</span>
        <div className="ml-auto flex gap-2">
          {isNearLimit && !atLimit && (
            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
              Near limit
            </Badge>
          )}
          {atLimit && (
            <Badge variant="destructive" className="text-[10px]">
              Limit reached
            </Badge>
          )}
          {value && (
            <span className="text-primary/60 animate-pulse text-[10px]">Auto-saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
