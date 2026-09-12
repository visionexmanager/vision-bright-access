/**
 * The parts of a travel form that must behave identically on all three pages.
 *
 * A sighted person finds a rejected field by its red ring. Somebody using NVDA
 * or VoiceOver finds it because the page tells them, once, in one place, with a
 * link that moves focus there — which is why `IssueSummary` takes focus itself
 * and every message is tied to its control with `aria-describedby`. The red ring
 * is a second signal, never the only one.
 */

import { forwardRef, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { errorId, fieldProps, hintId } from "@/features/travel/fieldIds";
import type { TravelIssue } from "@/features/travel/requests";
import { cn } from "@/lib/utils";

interface FieldProps {
  /** Also the `id` of the control it labels, so the summary can focus it. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A labelled control with its hint and its error, wired together.
 *
 * The control is passed in rather than rendered here: a date, a select and a
 * checkbox group are three different elements and one component that tried to be
 * all of them would take a `type` prop and lose every attribute that matters.
 */
export function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? (
        <p id={hintId(id)} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId(id)} className="flex items-start gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

interface SummaryProps {
  issues: readonly TravelIssue[];
  /** Turns an issue into the sentence a person reads. */
  describe: (issue: TravelIssue) => string;
  /** The visible label of the field an issue belongs to. */
  labelOf: (field: string) => string;
}

/**
 * Everything wrong with the form, once, above it.
 *
 * `tabIndex={-1}` with a ref so the page can move focus here after a failed
 * submit: a screen reader then reads the count and the list from the top, and
 * `Tab` continues into the first broken field rather than back at the start of
 * the page.
 */
export const IssueSummary = forwardRef<HTMLDivElement, SummaryProps>(function IssueSummary(
  { issues, describe, labelOf },
  ref,
) {
  const { t } = useLanguage();
  if (issues.length === 0) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertCircle aria-hidden="true" className="h-4 w-4" />
        {t("travel.form.issuesTitle").replace("{count}", String(issues.length))}
      </h2>
      <ul className="mt-2 space-y-1">
        {issues.map((issue) => (
          <li key={`${issue.field}-${issue.code}`} className="text-sm">
            <button
              type="button"
              className="text-start underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
              onClick={() => document.getElementById(issue.field)?.focus()}
            >
              <span className="font-medium">{labelOf(issue.field)}</span>
              {": "}
              {describe(issue)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});

/** A count that reads as a count. Selects beat spinbuttons for this everywhere. */
export function CountSelect({
  id,
  value,
  onChange,
  min,
  max,
  hasHint,
  hasError,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hasHint?: boolean;
  hasError?: boolean;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <select
      {...fieldProps(id, Boolean(hasHint), Boolean(hasError))}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
