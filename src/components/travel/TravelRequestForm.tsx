/**
 * One submit path for all three travel forms.
 *
 * Each page owns its own fields — a flight has a cabin and a stay has nights,
 * and a component that tried to render both would take a discriminated union and
 * be harder to read than three forms. What every page shares is what happens
 * *after* the fields: the check, the summary of what failed, who is asking, and
 * the confirmation. That is here, so the three pages cannot drift apart in the
 * part a screen-reader user depends on most.
 *
 * Validation runs on submit rather than on every keystroke. A field that turns
 * red while somebody is still typing in it announces an error they were in the
 * middle of fixing.
 */

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, IssueSummary } from "@/components/travel/TravelForm";
import { fieldProps } from "@/features/travel/fieldIds";
import { useSubmitLabel } from "@/features/travel/useSubmitLabel";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TravelDomain } from "@/features/travel/readiness";
import type { TravelIssue } from "@/features/travel/requests";
import { EMPTY_CONTACT, useTravelRequest, type Contact } from "@/features/travel/useTravelRequest";

interface Props {
  domain: TravelDomain;
  /**
   * The domain-specific fields, given whether to show their errors yet.
   *
   * A function rather than a node because the answer to "has this been
   * submitted" lives here and the fields live in the page. Passing the fields in
   * as plain children let a page render a red field on first paint, which is the
   * bug this signature exists to make impossible.
   */
  children: (showErrors: boolean) => ReactNode;
  /** Recomputed by the parent on every render from its own draft. */
  issues: readonly TravelIssue[];
  /** Only called once the draft is known to be complete. */
  buildSummary: () => string;
}

export function TravelRequestForm({ domain, children, issues, buildSummary }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { state, failure, send, reset } = useTravelRequest();
  const submitLabel = useSubmitLabel(domain);

  const [contact, setContact] = useState<Contact>({
    ...EMPTY_CONTACT,
    email: user?.email ?? "",
  });
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const shown = attempted ? issues : [];

  const labelOf = (field: string) => t(`travel.field.${field}`);
  const describe = (issue: TravelIssue) => t(`travel.err.${issue.code}`);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);

    if (issues.length > 0) {
      // Focus after paint, so the summary exists to receive it.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const ok = await send(domain, buildSummary(), contact);
    if (ok) requestAnimationFrame(() => doneRef.current?.focus());
  };

  if (state === "sent") {
    return (
      <div
        ref={doneRef}
        tabIndex={-1}
        role="status"
        className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-center"
      >
        <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-lg font-semibold">{t("travel.form.sentTitle")}</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
          {t("travel.form.sentBody").replace("{email}", contact.email)}
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={reset}>
          {t("travel.form.sentAgain")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <IssueSummary ref={summaryRef} issues={shown} describe={describe} labelOf={labelOf} />

      {children(attempted)}

      <section className="space-y-4 rounded-lg border border-border p-4 sm:p-6">
        <h2 className="text-base font-semibold">{t("travel.form.contactTitle")}</h2>

        {!user ? (
          <p className="text-sm text-muted-foreground">
            {t("travel.form.signedOut")}{" "}
            <Link to="/login" className="font-medium text-primary underline underline-offset-2">
              {t("svcReq.loginBtn")}
            </Link>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="name" label={t("travel.field.name")}>
            <Input
              {...fieldProps("name", false, false)}
              autoComplete="name"
              value={contact.name}
              onChange={(event) => setContact({ ...contact, name: event.target.value })}
            />
          </Field>
          <Field id="email" label={t("travel.field.email")}>
            <Input
              {...fieldProps("email", false, false)}
              type="email"
              autoComplete="email"
              value={contact.email}
              onChange={(event) => setContact({ ...contact, email: event.target.value })}
            />
          </Field>
        </div>

        <Field id="phone" label={t("travel.field.phone")} hint={t("travel.form.phoneHint")}>
          <Input
            {...fieldProps("phone", true, false)}
            type="tel"
            autoComplete="tel"
            value={contact.phone}
            onChange={(event) => setContact({ ...contact, phone: event.target.value })}
          />
        </Field>
      </section>

      {failure ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {t(`travel.form.failure.${failure}`)}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={state === "sending"} className="w-full sm:w-auto">
        <Send aria-hidden="true" className="me-2 h-4 w-4" />
        {state === "sending" ? t("svcReq.submitting") : submitLabel}
      </Button>
    </form>
  );
}

/** The shared note field, identical on all three forms. */
export function NotesField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  const { t } = useLanguage();
  return (
    <Field id="notes" label={t("travel.field.notes")} hint={hint}>
      <Textarea
        {...fieldProps("notes", true, false)}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
