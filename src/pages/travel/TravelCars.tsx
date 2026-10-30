/**
 * Car hire — where and when, who drives, and the access question asked outright.
 *
 * Hand controls are a field of their own for the reason the ride form asks for a
 * wheelchair accessible vehicle: a desk must be able to filter on a requirement,
 * not hope somebody reads a sentence. The driver's age is required because it
 * decides whether a company will rent at all and what it charges.
 */

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/travel/TravelForm";
import { ProviderDirectory } from "@/components/travel/ProviderDirectory";
import { NotesField, TravelRequestForm } from "@/components/travel/TravelRequestForm";
import { StageNotice, TravelShell } from "@/components/travel/TravelShell";
import { useLanguage } from "@/contexts/LanguageContext";
import { fieldProps } from "@/features/travel/fieldIds";
import {
  DRIVER_AGE_MAX,
  DRIVER_AGE_MIN,
  EMPTY_CAR_DRAFT,
  TRANSMISSIONS,
  carIssues,
  carSummary,
  type CarDraft,
} from "@/features/travel/requests";

export default function TravelCars() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<CarDraft>(EMPTY_CAR_DRAFT);
  const issues = useMemo(() => carIssues(draft), [draft]);

  const set = <K extends keyof CarDraft>(key: K, value: CarDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // Curried on `showErrors` so a field cannot go red before the first submit.
  const errorIn = (showErrors: boolean) => (field: string) => {
    if (!showErrors) return undefined;
    const found = issues.find((issue) => issue.field === field);
    return found ? t(`travel.err.${found.code}`) : undefined;
  };

  return (
    <TravelShell title={t("travel.cars.title")} lead={t("travel.cars.lead")}>
      <StageNotice domain="cars" />

      <TravelRequestForm domain="cars" issues={issues} buildSummary={() => carSummary(draft)}>
        {(showErrors) => {
          const errorFor = errorIn(showErrors);
          return (
            <>
              <section className="space-y-4">
                <h2 className="text-base font-semibold">{t("travel.stays.whereWhen")}</h2>

                <Field
                  id="pickup"
                  label={t("travel.field.pickup")}
                  hint={t("travel.cars.placeHint")}
                  error={errorFor("pickup")}
                >
                  <Input
                    {...fieldProps("pickup", true, Boolean(errorFor("pickup")))}
                    value={draft.pickup}
                    onChange={(event) => set("pickup", event.target.value)}
                  />
                </Field>

                <Field id="dropoff" label={t("travel.field.dropoff")} hint={t("travel.cars.dropoffHint")}>
                  <Input
                    {...fieldProps("dropoff", true, false)}
                    value={draft.dropoff}
                    onChange={(event) => set("dropoff", event.target.value)}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="pickupDate" label={t("travel.field.pickupDate")} error={errorFor("pickupDate")}>
                    <Input
                      {...fieldProps("pickupDate", false, Boolean(errorFor("pickupDate")))}
                      type="date"
                      value={draft.pickupDate}
                      onChange={(event) => set("pickupDate", event.target.value)}
                    />
                  </Field>
                  <Field id="pickupTime" label={t("travel.field.pickupTime")}>
                    <Input
                      {...fieldProps("pickupTime", false, false)}
                      type="time"
                      value={draft.pickupTime}
                      onChange={(event) => set("pickupTime", event.target.value)}
                    />
                  </Field>
                  <Field id="returnDate" label={t("travel.field.returnDate")} error={errorFor("returnDate")}>
                    <Input
                      {...fieldProps("returnDate", false, Boolean(errorFor("returnDate")))}
                      type="date"
                      value={draft.returnDate}
                      onChange={(event) => set("returnDate", event.target.value)}
                    />
                  </Field>
                  <Field id="returnTime" label={t("travel.field.returnTime")}>
                    <Input
                      {...fieldProps("returnTime", false, false)}
                      type="time"
                      value={draft.returnTime}
                      onChange={(event) => set("returnTime", event.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-base font-semibold">{t("travel.cars.driver")}</h2>

                <Field
                  id="driverAge"
                  label={t("travel.field.driverAge")}
                  hint={t("travel.cars.driverAgeHint")}
                  error={errorFor("driverAge")}
                >
                  <Input
                    {...fieldProps("driverAge", true, Boolean(errorFor("driverAge")))}
                    type="number"
                    inputMode="numeric"
                    min={DRIVER_AGE_MIN}
                    max={DRIVER_AGE_MAX}
                    value={draft.driverAge}
                    onChange={(event) => set("driverAge", event.target.value)}
                    className="sm:max-w-[10rem]"
                  />
                </Field>

                <Field id="transmission" label={t("travel.field.transmission")}>
                  <select
                    {...fieldProps("transmission", false, false)}
                    value={draft.transmission}
                    onChange={(event) => set("transmission", event.target.value as CarDraft["transmission"])}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
                  >
                    {TRANSMISSIONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`travel.transmission.${value}`)}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-center gap-3">
                  <input
                    {...fieldProps("handControls", false, false)}
                    type="checkbox"
                    checked={draft.handControls}
                    onChange={(event) => set("handControls", event.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                  <label htmlFor="handControls" className="text-sm font-medium">
                    {t("travel.field.handControls")}
                  </label>
                </div>

                <NotesField
                  value={draft.notes}
                  onChange={(value) => set("notes", value)}
                  hint={t("travel.cars.notesHint")}
                />
              </section>
            </>
          );
        }}
      </TravelRequestForm>

      <ProviderDirectory kind="cars" />
    </TravelShell>
  );
}
