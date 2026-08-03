import { HelpCircle } from "lucide-react";

interface GameInstructionsProps {
  /** Already-translated heading, e.g. "كيف تلعب" / "How to play". */
  title: string;
  /** Already-translated instruction sentences, in order. */
  steps: string[];
}

/**
 * Collapsible rules panel for games that carry their own bilingual copy instead
 * of i18n keys. Renders as a native <details> so it stays keyboard-operable and
 * is announced correctly without any extra ARIA wiring.
 */
export function GameInstructions({ title, steps }: GameInstructionsProps) {
  return (
    <details className="mt-6 rounded-xl border border-border bg-card/50 px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </summary>
      <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
