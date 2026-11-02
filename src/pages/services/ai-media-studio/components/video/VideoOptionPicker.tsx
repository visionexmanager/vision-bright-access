import type { VideoOptionInfo } from "@/lib/api/edgeFunctions";
import { clipPrice } from "@/hooks/useVideoOptions";

interface VideoOptionPickerProps {
  options:     VideoOptionInfo[];
  value:       string;
  durationSec: number;
  balance:     number | null;
  disabled?:   boolean;
  onChange:    (option: VideoOptionInfo) => void;
}

/**
 * The quality choices with what each costs in VX for the length picked.
 *
 * A native radio group inside a fieldset: arrow keys move between choices and a
 * screen reader announces the label, the description and the price together,
 * because all three are in the label's text.
 */
export function VideoOptionPicker({ options, value, durationSec, balance, disabled, onChange }: VideoOptionPickerProps) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quality and price
      </legend>

      {options.map((option) => {
        const seconds = option.durations.includes(durationSec) ? durationSec : option.durations[0];
        const price = clipPrice(option, seconds);
        const affordable = balance === null || balance >= price;
        const id = `video-option-${option.id}`;
        return (
          <label
            key={option.id}
            htmlFor={id}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm focus-within:ring-2 focus-within:ring-ring ${
              value === option.id ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <input
              id={id}
              type="radio"
              name="video-option"
              className="mt-1"
              checked={value === option.id}
              onChange={() => onChange(option)}
            />
            <span className="flex-1">
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.description}</span>
              <span className="mt-1 block text-xs">
                {option.vx_per_second} VX per second ·{" "}
                <strong>{price} VX</strong> for {seconds} seconds
                {!affordable && <span className="text-destructive"> · more than your balance</span>}
              </span>
            </span>
          </label>
        );
      })}

      {balance !== null && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Your balance: {balance} VX
        </p>
      )}
    </fieldset>
  );
}
