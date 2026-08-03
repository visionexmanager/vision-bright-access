import { useId, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as Icons from "lucide-react";
import { INTENTS } from "../hubs";
import { REASON_LABEL, findServices } from "../navigatorEngine";
import { pick } from "./localized";
import { ServiceCard } from "./ServiceCard";
import type { Difficulty, Intent } from "../types";

const LEVELS: { id: Difficulty; key: string }[] = [
  { id: "starter", key: "sc.level.starter" },
  { id: "intermediate", key: "sc.level.intermediate" },
  { id: "advanced", key: "sc.level.advanced" },
  { id: "expert", key: "sc.level.expert" },
];

function IntentIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

/**
 * The Service Navigator answers "what do you want to do?" before showing any
 * catalogue at all. Matching runs locally and instantly — see
 * `navigatorEngine.ts` for why that beats calling a model on the first click.
 */
export function ServiceNavigator({ completedSlugs = [] }: { completedSlugs?: string[] }) {
  const { t, lang } = useLanguage();
  const { playSound } = useSound();
  const uid = useId();

  const [intent, setIntent] = useState<Intent | undefined>();
  const [level, setLevel] = useState<Difficulty | undefined>();
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");

  const matches = useMemo(
    () => findServices({ intent, level, text: submitted, completedSlugs }, 6),
    [intent, level, submitted, completedSlugs]
  );

  const hasQuery = Boolean(intent || level || submitted.trim());
  const resultsId = `${uid}-results`;

  const reset = () => {
    setIntent(undefined);
    setLevel(undefined);
    setText("");
    setSubmitted("");
    playSound("click");
  };

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className="rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary" aria-hidden="true">
          <Icons.Compass className="h-5 w-5" />
        </span>
        <div>
          <h2 id={`${uid}-heading`} className="text-xl font-bold text-foreground">
            {t("sc.navigator.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("sc.navigator.subtitle")}</p>
        </div>
      </div>

      {/* Intent chips */}
      <div
        role="group"
        aria-label={t("sc.navigator.intentLabel")}
        className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {INTENTS.map((option) => {
          const active = intent === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setIntent(active ? undefined : option.id);
                playSound("click");
              }}
              className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className={active ? "text-primary-foreground" : "text-primary"}>
                <IntentIcon name={option.icon} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{pick(option.label, lang)}</span>
                <span
                  className={`block text-xs ${
                    active ? "text-primary-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {pick(option.hint, lang)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Free text + level */}
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(text);
          playSound("click");
        }}
      >
        <div className="flex-1">
          <label htmlFor={`${uid}-text`} className="mb-1 block text-sm font-medium text-foreground">
            {t("sc.navigator.describeLabel")}
          </label>
          <Input
            id={`${uid}-text`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("sc.navigator.describePlaceholder")}
            aria-describedby={`${uid}-hint`}
          />
          <p id={`${uid}-hint`} className="mt-1 text-xs text-muted-foreground">
            {t("sc.navigator.describeHint")}
          </p>
        </div>
        <Button type="submit" className="sm:mb-6">
          {t("sc.navigator.submit")}
        </Button>
      </form>

      <div role="group" aria-label={t("sc.navigator.levelLabel")} className="mt-2 flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium text-muted-foreground">
          {t("sc.navigator.levelLabel")}
        </span>
        {LEVELS.map((option) => {
          const active = level === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setLevel(active ? undefined : option.id);
                playSound("click");
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(option.key)}
            </button>
          );
        })}
        {hasQuery && (
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("sc.navigator.reset")}
          </button>
        )}
      </div>

      {/* Results */}
      <div id={resultsId} aria-live="polite" className="mt-5">
        {!hasQuery ? (
          <p className="text-sm text-muted-foreground">{t("sc.navigator.idle")}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("sc.navigator.noResults")}</p>
        ) : (
          <>
            <p className="mb-3 text-sm font-medium text-foreground">
              {t(
                matches.length === 1 ? "sc.navigator.resultCountOne" : "sc.navigator.resultCount"
              ).replace("{n}", String(matches.length))}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {matches.map((match) => (
                <div key={match.entry.slug} role="listitem">
                  <ServiceCard
                    entry={match.entry}
                    completed={completedSlugs.includes(match.entry.slug)}
                    reason={pick(REASON_LABEL[match.reasons[0]], lang)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
