import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRICING_PATH } from "@/lib/billing/plans";
import {
  fillTemplate,
  PAYMENT_METHODS,
  paymentWhatsAppLink,
  type PaymentMethod,
} from "@/lib/billing/whatsappCheckout";
import {
  createSubscriptionOrder,
  fetchPaymentWhatsAppNumber,
  type SubscriptionOrderRow,
} from "@/services/subscriptionOrders";

/**
 * The last step before paying for a plan.
 *
 * Choosing how to pay files an order and opens WhatsApp at the owner's number
 * with the order already written. The owner arranges the payment and approves
 * the order; nothing here activates anything.
 */
export default function PlanCheckout() {
  const { planId = "" } = useParams();
  const { t, translateText, dir } = useLanguage();
  const [method, setMethod] = useState<PaymentMethod>("omt");
  const [order, setOrder] = useState<SubscriptionOrderRow | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const readyHeading = useRef<HTMLHeadingElement>(null);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["billing-plan", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_plans")
        .select("id, name, description, price_monthly_usd")
        .eq("id", planId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: number, isLoading: numberLoading } = useQuery({
    queryKey: ["subscription-payment-whatsapp"],
    queryFn: fetchPaymentWhatsAppNumber,
  });

  // The page changes under a screen reader's feet once the order exists, so
  // focus goes to the heading that says what happened.
  useEffect(() => {
    if (order) readyHeading.current?.focus();
  }, [order]);

  const payable = !!plan && plan.price_monthly_usd > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!plan || !number || submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      const created = await createSubscriptionOrder(plan.id, method);
      const message = fillTemplate(t("planCheckout.whatsappMessage"), {
        reference: created.reference_code,
        plan: translateText(plan.name),
        price: String(created.price_usd),
        method: t(`planCheckout.method.${method}`),
      });
      const url = paymentWhatsAppLink(number, message);
      setOrder(created);
      setLink(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <main className="mx-auto max-w-2xl px-4 py-12" dir={dir}>
        <Link to={PRICING_PATH} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("planCheckout.back")}
        </Link>

        <h1 className="mt-4 text-3xl font-black">{t("planCheckout.title")}</h1>

        {isLoading ? (
          <p className="mt-8" role="status">{t("common.loading")}</p>
        ) : !payable ? (
          <p className="mt-8" role="alert">{t("planCheckout.notFound")}</p>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-border bg-card p-6" aria-labelledby="checkout-plan">
              <h2 id="checkout-plan" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                {t("planCheckout.planSummary")}
              </h2>
              <p className="mt-2 text-2xl font-bold">{translateText(plan.name)}</p>
              <p className="mt-1 text-xl font-black">
                ${plan.price_monthly_usd}
                <span className="text-base font-normal text-muted-foreground"> / {t("plans.perMonth")}</span>
              </p>
              {plan.description && (
                <p className="mt-2 text-sm text-muted-foreground">{translateText(plan.description)}</p>
              )}
            </section>

            {order && link ? (
              <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6" aria-labelledby="checkout-ready">
                <h2 id="checkout-ready" ref={readyHeading} tabIndex={-1} className="text-lg font-bold focus:outline-none">
                  {t("planCheckout.readyTitle")}
                </h2>
                <p className="mt-2 text-sm">
                  {fillTemplate(t("planCheckout.readyBody"), { reference: order.reference_code })}
                </p>
                <Button asChild className="mt-4 w-full">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="me-2 h-4 w-4" aria-hidden="true" />
                    {t("planCheckout.openWhatsapp")}
                  </a>
                </Button>
              </section>
            ) : (
              <form className="mt-8 space-y-6" onSubmit={submit}>
                <fieldset className="space-y-3">
                  <legend className="text-lg font-bold">{t("planCheckout.methodTitle")}</legend>
                  {PAYMENT_METHODS.map((value) => (
                    <label
                      key={value}
                      className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                        method === value ? "border-primary ring-2 ring-primary/30" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={value}
                        checked={method === value}
                        onChange={() => setMethod(value)}
                        aria-describedby={`method-${value}-hint`}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <span>
                        <span className="block font-semibold">{t(`planCheckout.method.${value}`)}</span>
                        <span id={`method-${value}-hint`} className="block text-sm text-muted-foreground">
                          {t(`planCheckout.method.${value}Hint`)}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <p className="text-sm text-muted-foreground">{t("planCheckout.howItWorks")}</p>

                {!numberLoading && !number && (
                  <p role="alert" className="text-sm font-medium text-destructive">{t("planCheckout.unavailable")}</p>
                )}
                {failed && (
                  <p role="alert" className="text-sm font-medium text-destructive">{t("planCheckout.error")}</p>
                )}

                <Button type="submit" className="w-full" disabled={submitting || !number}>
                  <MessageCircle className="me-2 h-4 w-4" aria-hidden="true" />
                  {submitting ? t("planCheckout.creating") : t("planCheckout.continue")}
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </Layout>
  );
}
