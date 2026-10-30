/**
 * Assistive product sourcing: a directory of vendors and a request desk.
 *
 * Not a catalogue. The vendors are listed and linked; the person describes what
 * they need (and may paste the vendor page), and either asks Visionex to order
 * it, which files a request to the team for a quote, or talks to support on
 * WhatsApp with the request already written. No vendor content is copied.
 */

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, MessageCircle, Send } from "lucide-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, IssueSummary } from "@/components/travel/TravelForm";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { fieldProps } from "@/features/travel/fieldIds";
import { EMPTY_CONTACT, type Contact } from "@/features/travel/useTravelRequest";
import {
  EMPTY_SOURCING_DRAFT,
  PRODUCT_MAX,
  SPECS_MAX,
  LINK_MAX,
  SERVICE_FEE_PERCENT,
  sourcingIssues,
  sourcingSummary,
  type SourcingDraft,
  type SourcingRoute,
} from "@/features/sourcing/requests";
import { useSourcingRequest } from "@/features/sourcing/useSourcingRequest";
import { VENDORS, VENDOR_CATEGORIES } from "@/features/sourcing/vendors";
import { supportWhatsAppLink } from "@/lib/supportContact";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function AssistiveSourcing() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { state, failure, send, reset } = useSourcingRequest();

  const [draft, setDraft] = useState<SourcingDraft>(EMPTY_SOURCING_DRAFT);
  const [contact, setContact] = useState<Contact>({ ...EMPTY_CONTACT, email: user?.email ?? "" });
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => sourcingIssues(draft), [draft]);
  const shown = attempted ? issues : [];
  const set = <K extends keyof SourcingDraft>(key: K, value: SourcingDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const errorFor = (field: string) => {
    if (!attempted) return undefined;
    const found = issues.find((issue) => issue.field === field);
    return found ? t(`sourcing.err.${found.code}`) : undefined;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (issues.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const route = draft.route as SourcingRoute;
    const summary = sourcingSummary(draft);
    if (route === "support") {
      // No account needed to talk to support, and nothing personal in the link.
      window.open(
        supportWhatsAppLink(`${t("sourcing.support.prefill")}\n\n${summary}`),
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    const ok = await send(route, summary, contact);
    if (ok) requestAnimationFrame(() => doneRef.current?.focus());
  };

  const startAgain = () => {
    reset();
    setDraft(EMPTY_SOURCING_DRAFT);
    setAttempted(false);
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("sourcing.title")}</h1>
          <p className="text-muted-foreground">{t("sourcing.lead")}</p>
          <p>
            <a href="#sourcing-request" className={`text-sm font-medium text-primary underline underline-offset-4 ${focusRing}`}>
              {t("sourcing.skipToForm")}
            </a>
          </p>
        </header>

        <section aria-labelledby="sourcing-vendors" className="mt-8 space-y-4">
          <h2 id="sourcing-vendors" className="text-xl font-semibold">
            {t("sourcing.vendors.title")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("sourcing.vendors.lead")}</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {VENDORS.map((vendor) => (
              <li key={vendor.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <h3 className="text-base font-semibold">{vendor.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {countryName(vendor.country, lang)} ·{" "}
                  {VENDOR_CATEGORIES.filter((c) => vendor.categories.includes(c))
                    .map((c) => t(`sourcing.cat.${c}`))
                    .join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">{t(`sourcing.ships.${vendor.shipping}`)}</p>
                <p className="text-xs text-muted-foreground">
                  {t("sourcing.vendors.checked").replace("{date}", vendor.checkedOn)}
                </p>
                <a
                  href={vendor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`}
                >
                  {t("sourcing.vendors.official")}: {vendor.name}
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  <span className="sr-only">{t("sourcing.vendors.newTab")}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section id="sourcing-request" aria-labelledby="sourcing-form-title" className="mt-12 scroll-mt-20">
          <h2 id="sourcing-form-title" className="text-xl font-semibold">
            {t("sourcing.form.title")}
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("sourcing.form.lead")}</p>

          {state === "sent" ? (
            <div
              ref={doneRef}
              tabIndex={-1}
              role="status"
              className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-6 text-center"
            >
              <CheckCircle2 aria-hidden="true" className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{t("sourcing.sent.title")}</h3>
              <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
                {t("sourcing.sent.body").replace("{email}", contact.email)}
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={startAgain}>
                {t("sourcing.sent.again")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
              <IssueSummary
                ref={summaryRef}
                issues={shown}
                describe={(issue) => t(`sourcing.err.${issue.code}`)}
                labelOf={(field) => t(`sourcing.field.${field}`)}
              />

              <Field id="product" label={t("sourcing.field.product")} hint={t("sourcing.field.productHint")} error={errorFor("product")}>
                <Input
                  {...fieldProps("product", true, Boolean(errorFor("product")))}
                  maxLength={PRODUCT_MAX}
                  value={draft.product}
                  onChange={(e) => set("product", e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="vendorId" label={t("sourcing.field.vendorId")}>
                  <select
                    {...fieldProps("vendorId", false, false)}
                    value={draft.vendorId}
                    onChange={(e) => set("vendorId", e.target.value)}
                    className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm ${focusRing}`}
                  >
                    <option value="">{t("sourcing.field.vendorAny")}</option>
                    {VENDORS.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field id="quantity" label={t("sourcing.field.quantity")} error={errorFor("quantity")}>
                  <Input
                    {...fieldProps("quantity", false, Boolean(errorFor("quantity")))}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={draft.quantity}
                    onChange={(e) => set("quantity", Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field id="link" label={t("sourcing.field.link")} hint={t("sourcing.field.linkHint")} error={errorFor("link")}>
                <Input
                  {...fieldProps("link", true, Boolean(errorFor("link")))}
                  type="url"
                  dir="ltr"
                  maxLength={LINK_MAX}
                  autoComplete="off"
                  value={draft.link}
                  onChange={(e) => set("link", e.target.value)}
                />
              </Field>

              <Field id="specs" label={t("sourcing.field.specs")} hint={t("sourcing.field.specsHint")}>
                <Textarea
                  {...fieldProps("specs", true, false)}
                  rows={5}
                  maxLength={SPECS_MAX}
                  value={draft.specs}
                  onChange={(e) => set("specs", e.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="country" label={t("sourcing.field.country")} error={errorFor("country")}>
                  <Input
                    {...fieldProps("country", false, Boolean(errorFor("country")))}
                    autoComplete="country-name"
                    value={draft.country}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </Field>
                <Field id="budget" label={t("sourcing.field.budget")} hint={t("sourcing.field.budgetHint")}>
                  <Input
                    {...fieldProps("budget", true, false)}
                    maxLength={60}
                    value={draft.budget}
                    onChange={(e) => set("budget", e.target.value)}
                  />
                </Field>
              </div>

              <fieldset
                aria-describedby={errorFor("route") ? "sourcing-route-error" : undefined}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <legend className="px-1 text-sm font-semibold">{t("sourcing.route.title")}</legend>
                {(["order", "support"] as const).map((route) => (
                  <div key={route} className="flex items-start gap-3">
                    <input
                      id={`route-${route}`}
                      type="radio"
                      name="route"
                      value={route}
                      checked={draft.route === route}
                      onChange={() => set("route", route)}
                      aria-describedby={`route-${route}-hint`}
                      className={`mt-1 h-4 w-4 accent-primary ${focusRing}`}
                    />
                    <div>
                      <label htmlFor={`route-${route}`} className="text-sm font-medium">
                        {t(`sourcing.route.${route}`)}
                      </label>
                      <p id={`route-${route}-hint`} className="text-xs text-muted-foreground">
                        {t(`sourcing.route.${route}Hint`)}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {t("sourcing.route.fee").replace("{percent}", String(SERVICE_FEE_PERCENT))}
                </p>
                {errorFor("route") ? (
                  <p id="sourcing-route-error" className="text-sm font-medium text-destructive">
                    {errorFor("route")}
                  </p>
                ) : null}
              </fieldset>

              {draft.route === "order" ? (
                <section className="space-y-4 rounded-lg border border-border p-4 sm:p-6">
                  <h3 className="text-base font-semibold">{t("travel.form.contactTitle")}</h3>
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
                        onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      />
                    </Field>
                    <Field id="email" label={t("travel.field.email")}>
                      <Input
                        {...fieldProps("email", false, false)}
                        type="email"
                        autoComplete="email"
                        value={contact.email}
                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field id="phone" label={t("travel.field.phone")} hint={t("travel.form.phoneHint")}>
                    <Input
                      {...fieldProps("phone", true, false)}
                      type="tel"
                      autoComplete="tel"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    />
                  </Field>
                </section>
              ) : null}

              {failure ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {t(`travel.form.failure.${failure}`)}
                </p>
              ) : null}

              <Button type="submit" size="lg" disabled={state === "sending"} className="w-full sm:w-auto">
                {draft.route === "support" ? (
                  <MessageCircle aria-hidden="true" className="me-2 h-4 w-4" />
                ) : (
                  <Send aria-hidden="true" className="me-2 h-4 w-4" />
                )}
                {state === "sending"
                  ? t("svcReq.submitting")
                  : draft.route === "support"
                    ? t("sourcing.submit.support")
                    : t("sourcing.submit.order")}
              </Button>
            </form>
          )}
        </section>
      </div>
    </Layout>
  );
}
