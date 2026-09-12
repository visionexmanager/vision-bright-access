/**
 * Stays — a destination, two dates and who is sleeping there.
 *
 * The one field that looks unusual is deliberate: children are entered as ages,
 * not as a count, because a property prices a four-year-old and an eleven-year-old
 * differently and wants to know before the family arrives. `hotels.ts` makes the
 * same choice for the same reason.
 */

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { CountSelect, Field } from "@/components/travel/TravelForm";
import { fieldProps } from "@/features/travel/fieldIds";
import { NotesField, TravelRequestForm } from "@/components/travel/TravelRequestForm";
import { StageNotice, TravelShell } from "@/components/travel/TravelShell";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  EMPTY_STAY_DRAFT,
  MAX_ROOMS,
  stayIssues,
  stayNights,
  staySummary,
  type StayDraft,
} from "@/features/travel/requests";
import { BOARD_BASIS } from "../../../supabase/functions/_shared/hotels.ts";

/**
 * How far the adults list counts.
 *
 * Eight per room across five rooms is forty, and a forty-option select is a
 * minute of arrow keys for somebody booking a family holiday with a screen
 * reader. Twenty covers every party this form is for and still reaches the rule
 * underneath it — twenty adults in two rooms is ten a room, which the core
 * refuses. Beyond twenty is a group booking, which is a conversation.
 */
const MAX_ADULTS_IN_FORM = 20;

/** "4, 11" → [4, 11]. Anything that is not a number is dropped, not guessed. */
const parseAges = (value: string): number[] =>
  value
    .split(/[,،\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((age) => Number.isFinite(age));

export default function TravelStays() {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<StayDraft>(EMPTY_STAY_DRAFT);
  const [agesText, setAgesText] = useState("");
  const issues = useMemo(() => stayIssues(draft), [draft]);
  const nights = stayNights(draft);

  const set = <K extends keyof StayDraft>(key: K, value: StayDraft[K]) =>
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
    <TravelShell title={t("travel.stays.title")} lead={t("travel.stays.lead")}>
      <StageNotice domain="stays" />

      <TravelRequestForm domain="stays" issues={issues} buildSummary={() => staySummary(draft)}>
        {(showErrors) => {
          const errorFor = errorIn(showErrors);
          return (
            <>
            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.stays.whereWhen")}</h2>

              <Field
                id="destination"
                label={t("travel.field.destination")}
                hint={t("travel.stays.destinationHint")}
                error={errorFor("destination")}
              >
                <Input
                  {...fieldProps("destination", true, Boolean(errorFor("destination")))}
                  value={draft.destination}
                  onChange={(event) => set("destination", event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="checkIn" label={t("travel.field.checkIn")} error={errorFor("checkIn")}>
                  <Input
                    {...fieldProps("checkIn", false, Boolean(errorFor("checkIn")))}
                    type="date"
                    value={draft.checkIn}
                    onChange={(event) => set("checkIn", event.target.value)}
                  />
                </Field>
                <Field id="checkOut" label={t("travel.field.checkOut")} error={errorFor("checkOut")}>
                  <Input
                    {...fieldProps("checkOut", false, Boolean(errorFor("checkOut")))}
                    type="date"
                    value={draft.checkOut}
                    onChange={(event) => set("checkOut", event.target.value)}
                  />
                </Field>
              </div>

              {/* Announced as it changes: the count is the answer to "did the dates
                  land where I meant", and a guest who cannot see the calendar has no
                  other way to check it. */}
              <p role="status" className="text-sm text-muted-foreground">
                {nights === null ? "" : t("travel.stays.nightsCount").replace("{n}", String(nights))}
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">{t("travel.stays.whoIsStaying")}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="rooms" label={t("travel.field.rooms")} error={errorFor("rooms")}>
                  <CountSelect
                    id="rooms"
                    value={draft.rooms}
                    onChange={(value) => set("rooms", value)}
                    min={1}
                    max={MAX_ROOMS}
                    hasError={Boolean(errorFor("rooms"))}
                  />
                </Field>
                <Field id="adults" label={t("travel.field.adults")} error={errorFor("adults")}>
                  <CountSelect
                    id="adults"
                    value={draft.adults}
                    onChange={(value) => set("adults", value)}
                    min={1}
                    max={MAX_ADULTS_IN_FORM}
                    hasError={Boolean(errorFor("adults"))}
                  />
                </Field>
              </div>

              <Field
                id="childAges"
                label={t("travel.field.childAges")}
                hint={t("travel.stays.childAgesHint")}
                error={errorFor("childAges")}
              >
                <Input
                  {...fieldProps("childAges", true, Boolean(errorFor("childAges")))}
                  inputMode="numeric"
                  value={agesText}
                  onChange={(event) => {
                    setAgesText(event.target.value);
                    set("childAges", parseAges(event.target.value));
                  }}
                />
              </Field>

              <Field id="board" label={t("travel.field.board")}>
                <select
                  {...fieldProps("board", false, false)}
                  value={draft.board}
                  onChange={(event) => set("board", event.target.value as StayDraft["board"])}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs"
                >
                  <option value="">{t("travel.board.any")}</option>
                  {BOARD_BASIS.map((board) => (
                    <option key={board} value={board}>
                      {t(`travel.board.${board}`)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex items-center gap-3">
                <input
                  {...fieldProps("freeCancellation", false, false)}
                  type="checkbox"
                  checked={draft.freeCancellationOnly}
                  onChange={(event) => set("freeCancellationOnly", event.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <label htmlFor="freeCancellation" className="text-sm font-medium">
                  {t("travel.field.freeCancellation")}
                </label>
              </div>

              <NotesField
                value={draft.notes}
                onChange={(value) => set("notes", value)}
                hint={t("travel.stays.notesHint")}
              />
            </section>
            </>
          );
        }}
      </TravelRequestForm>
    </TravelShell>
  );
}
