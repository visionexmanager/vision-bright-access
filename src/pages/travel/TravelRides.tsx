/**
 * Rides — two places, and a time only if it matters.
 *
 * The shortest of the three forms on purpose. A ride is usually now, so
 * everything except the two addresses is optional, and the page asks the
 * accessibility question outright rather than leaving it to the note field: a
 * wheelchair accessible vehicle is a requirement a dispatcher must be able to
 * filter on, not a sentence somebody has to read and remember to act on.
 */

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { CountSelect, Field } from "@/components/travel/TravelForm";
import { fieldProps } from "@/features/travel/fieldIds";
import { NotesField, TravelRequestForm } from "@/components/travel/TravelRequestForm";
import { StageNotice, TravelShell } from "@/components/travel/TravelShell";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  EMPTY_RIDE_DRAFT,
  MAX_RIDERS,
  rideIssues,
  rideSummary,
  type RideDraft,
} from "@/features/travel/requests";

export default function TravelRides() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<RideDraft>(EMPTY_RIDE_DRAFT);
  const issues = useMemo(() => rideIssues(draft), [draft]);

  const set = <K extends keyof RideDraft>(key: K, value: RideDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // Curried on `showErrors` so a field cannot go red before the first submit:
  // a message announced while somebody is still filling the form describes a
  // mistake they have not finished not making.
  const errorIn = (showErrors: boolean) => (field: string) => {
    if (!showErrors) return undefined;
    const found = issues.find((issue) => issue.field === field);
    return found ? t(`travel.err.${found.code}`) : undefined;
  };

  return (
    <TravelShell title={t("travel.rides.title")} lead={t("travel.rides.lead")}>
      <StageNotice domain="rides" />

      <TravelRequestForm domain="rides" issues={issues} buildSummary={() => rideSummary(draft)}>
        {(showErrors) => {
          const errorFor = errorIn(showErrors);
          return (
            <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.rides.route")}</h2>

              <Field
                id="pickup"
                label={t("travel.field.pickup")}
                hint={t("travel.rides.placeHint")}
                error={errorFor("pickup")}
              >
                <Input
                  {...fieldProps("pickup", true, Boolean(errorFor("pickup")))}
                  value={draft.pickup}
                  onChange={(event) => set("pickup", event.target.value)}
                />
              </Field>

              <Field
                id="destination"
                label={t("travel.field.destination")}
                hint={t("travel.rides.placeHint")}
                error={errorFor("destination")}
              >
                <Input
                  {...fieldProps("destination", true, Boolean(errorFor("destination")))}
                  value={draft.destination}
                  onChange={(event) => set("destination", event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="date"
                  label={t("travel.field.date")}
                  hint={t("travel.rides.whenHint")}
                  error={errorFor("date")}
                >
                  <Input
                    {...fieldProps("date", true, Boolean(errorFor("date")))}
                    type="date"
                    value={draft.date}
                    onChange={(event) => set("date", event.target.value)}
                  />
                </Field>
                <Field id="time" label={t("travel.field.time")} hint={t("travel.rides.timeHint")}>
                  <Input
                    {...fieldProps("time", true, false)}
                    type="time"
                    value={draft.time}
                    onChange={(event) => set("time", event.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.rides.vehicle")}</h2>

              <Field id="passengers" label={t("travel.field.passengers")} error={errorFor("passengers")}>
                <CountSelect
                  id="passengers"
                  value={draft.passengers}
                  onChange={(value) => set("passengers", value)}
                  min={1}
                  max={MAX_RIDERS}
                  hasError={Boolean(errorFor("passengers"))}
                />
              </Field>

              <div className="flex items-center gap-3">
                <input
                  {...fieldProps("wheelchair", false, false)}
                  type="checkbox"
                  checked={draft.wheelchairAccessible}
                  onChange={(event) => set("wheelchairAccessible", event.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <label htmlFor="wheelchair" className="text-sm font-medium">
                  {t("travel.field.wheelchair")}
                </label>
              </div>

              <NotesField
                value={draft.notes}
                onChange={(value) => set("notes", value)}
                hint={t("travel.rides.notesHint")}
              />
            </section>
            </>
          );
        }}
      </TravelRequestForm>
    </TravelShell>
  );
}
