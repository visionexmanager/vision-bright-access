/**
 * Flights — the fields a fare search needs, asked once.
 *
 * Every rule this form enforces lives in `src/features/travel/requests.ts`, which
 * calls the flight core rather than restating it. The page is the presentation
 * of those rules and holds none of its own.
 */

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { CountSelect, Field } from "@/components/travel/TravelForm";
import { fieldProps } from "@/features/travel/fieldIds";
import { NotesField, TravelRequestForm } from "@/components/travel/TravelRequestForm";
import { StageNotice, TravelShell } from "@/components/travel/TravelShell";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  EMPTY_FLIGHT_DRAFT,
  MAX_TRAVELLERS,
  flightIssues,
  flightSummary,
  type FlightDraft,
} from "@/features/travel/requests";
import { CABINS } from "../../../supabase/functions/_shared/flights.ts";

export default function TravelFlights() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<FlightDraft>(EMPTY_FLIGHT_DRAFT);
  const issues = useMemo(() => flightIssues(draft), [draft]);

  const set = <K extends keyof FlightDraft>(key: K, value: FlightDraft[K]) =>
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
    <TravelShell title={t("travel.flights.title")} lead={t("travel.flights.lead")}>
      <StageNotice domain="flights" />

      <TravelRequestForm domain="flights" issues={issues} buildSummary={() => flightSummary(draft)}>
        {(showErrors) => {
          const errorFor = errorIn(showErrors);
          return (
            <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.flights.journey")}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="origin"
                  label={t("travel.field.origin")}
                  hint={t("travel.flights.placeHint")}
                  error={errorFor("origin")}
                >
                  <Input
                    {...fieldProps("origin", true, Boolean(errorFor("origin")))}
                    value={draft.origin}
                    onChange={(event) => set("origin", event.target.value)}
                  />
                </Field>
                <Field
                  id="destination"
                  label={t("travel.field.destination")}
                  hint={t("travel.flights.placeHint")}
                  error={errorFor("destination")}
                >
                  <Input
                    {...fieldProps("destination", true, Boolean(errorFor("destination")))}
                    value={draft.destination}
                    onChange={(event) => set("destination", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="departDate" label={t("travel.field.departDate")} error={errorFor("departDate")}>
                  <Input
                    {...fieldProps("departDate", false, Boolean(errorFor("departDate")))}
                    type="date"
                    value={draft.departDate}
                    onChange={(event) => set("departDate", event.target.value)}
                  />
                </Field>
                <Field
                  id="returnDate"
                  label={t("travel.field.returnDate")}
                  hint={t("travel.flights.returnHint")}
                  error={errorFor("returnDate")}
                >
                  <Input
                    {...fieldProps("returnDate", true, Boolean(errorFor("returnDate")))}
                    type="date"
                    value={draft.returnDate}
                    onChange={(event) => set("returnDate", event.target.value)}
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.flights.travellers")}</h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field id="adults" label={t("travel.field.adults")} error={errorFor("adults")}>
                  <CountSelect
                    id="adults"
                    value={draft.adults}
                    onChange={(value) => set("adults", value)}
                    min={1}
                    max={MAX_TRAVELLERS}
                    hasError={Boolean(errorFor("adults"))}
                  />
                </Field>
                <Field
                  id="children"
                  label={t("travel.field.children")}
                  hint={t("travel.flights.childHint")}
                >
                  <CountSelect
                    id="children"
                    value={draft.children}
                    onChange={(value) => set("children", value)}
                    min={0}
                    max={MAX_TRAVELLERS - 1}
                    hasHint
                  />
                </Field>
                <Field
                  id="infants"
                  label={t("travel.field.infants")}
                  hint={t("travel.flights.infantHint")}
                  error={errorFor("infants")}
                >
                  <CountSelect
                    id="infants"
                    value={draft.infants}
                    onChange={(value) => set("infants", value)}
                    min={0}
                    max={MAX_TRAVELLERS - 1}
                    hasHint
                    hasError={Boolean(errorFor("infants"))}
                  />
                </Field>
              </div>

              <Field id="cabin" label={t("travel.field.cabin")}>
                <select
                  {...fieldProps("cabin", false, false)}
                  value={draft.cabin}
                  onChange={(event) => set("cabin", event.target.value as FlightDraft["cabin"])}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
                >
                  {CABINS.map((cabin) => (
                    <option key={cabin} value={cabin}>
                      {t(`travel.cabin.${cabin}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <NotesField
                value={draft.notes}
                onChange={(value) => set("notes", value)}
                hint={t("travel.flights.notesHint")}
              />
            </section>
            </>
          );
        }}
      </TravelRequestForm>
    </TravelShell>
  );
}
