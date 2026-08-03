import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedSection } from "@/components/AnimatedSection";
import { ArrowLeft, Briefcase, Check, Star } from "lucide-react";
import { toast } from "sonner";

import {
  ORDER_FLOW,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_HINT,
  ORDER_STATUS_LABEL,
  RATING_LABEL,
  canRate,
  orderProgress,
  parseOrderStatus,
  sortOrders,
  type ServiceOrder,
} from "@/features/servicecenter/marketplace";
import { pick } from "@/features/servicecenter/components/localized";
import { getServiceEntry } from "@/features/servicecenter/catalog";

/**
 * The client file. Every professional service request the visitor has made,
 * with where it has actually got to and the ability to rate finished work.
 */
export default function MyServiceRequests() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { playSound } = useSound();
  const uid = useId();

  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("service_requests")
        .select("id, service_type, message, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      setOrders(
        (data ?? []).map((row) => ({
          id: row.id,
          serviceType: row.service_type,
          message: row.message,
          status: parseOrderStatus(row.status),
          createdAt: row.created_at,
        }))
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sorted = useMemo(() => sortOrders(orders), [orders]);

  const rate = (id: string, rating: number) => {
    // Ratings are held locally for now — the review table is not deployed yet,
    // so we acknowledge the input without claiming it reached the team.
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, rating } : o)));
    playSound("click");
    toast.success(t("sc.orders.ratingSaved"));
  };

  return (
    <Layout>
      <section className="section-container py-10" aria-labelledby={`${uid}-heading`}>
        <Link
          to="/services"
          onClick={() => playSound("navigate")}
          className="mb-5 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("sc.backToCenter")}
        </Link>

        <h1 id={`${uid}-heading`} className="type-heading text-foreground">
          {t("sc.orders.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{t("sc.orders.subtitle")}</p>

        <div className="mt-8" aria-live="polite">
          {!user ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">{t("sc.orders.signInPrompt")}</p>
                <Button asChild className="mt-4">
                  <Link to="/login">{t("sc.orders.signIn")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : loading ? (
            <div role="status" className="flex justify-center py-12">
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
                aria-hidden="true"
              />
              <span className="sr-only">{t("sc.orders.loading")}</span>
            </div>
          ) : sorted.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
                <p className="mt-3 text-muted-foreground">{t("sc.orders.empty")}</p>
                <Button asChild className="mt-4">
                  <Link to="/services">{t("sc.orders.browse")}</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {sorted.map((order) => {
                const entry = getServiceEntry(order.serviceType);
                const percent = orderProgress(order.status);
                const stepIndex = ORDER_FLOW.indexOf(order.status);

                return (
                  <li key={order.id}>
                    <AnimatedSection>
                      <Card>
                        <CardContent className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h2 className="font-bold text-foreground">
                                {entry ? pick(entry.title, lang) : order.serviceType}
                              </h2>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {t("sc.orders.reference").replace(
                                  "{id}",
                                  order.id.slice(0, 8).toUpperCase()
                                )}
                                {" · "}
                                {new Date(order.createdAt).toLocaleDateString(lang)}
                              </p>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold ${ORDER_STATUS_CLASS[order.status]}`}
                            >
                              {pick(ORDER_STATUS_LABEL[order.status], lang)}
                            </span>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                            {order.message}
                          </p>

                          {order.status !== "cancelled" && (
                            <>
                              <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {ORDER_FLOW.map((step, index) => {
                                  const reached = stepIndex >= index;
                                  return (
                                    <li
                                      key={step}
                                      className={`inline-flex items-center gap-1 ${
                                        reached ? "font-semibold text-foreground" : "text-muted-foreground/60"
                                      }`}
                                    >
                                      {reached && (
                                        <Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
                                      )}
                                      {pick(ORDER_STATUS_LABEL[step], lang)}
                                    </li>
                                  );
                                })}
                              </ol>

                              <div
                                role="progressbar"
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={t("sc.orders.progressLabel")}
                                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                              >
                                <div
                                  className="h-full rounded-full bg-primary transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </>
                          )}

                          <p className="mt-3 text-sm text-muted-foreground">
                            {pick(ORDER_STATUS_HINT[order.status], lang)}
                          </p>

                          {canRate(order.status) && (
                            <div className="mt-4 border-t border-border pt-4">
                              <p className="text-sm font-semibold text-foreground">
                                {order.rating ? t("sc.orders.yourRating") : t("sc.orders.rateAsk")}
                              </p>
                              <div
                                role="group"
                                aria-label={t("sc.orders.rateAsk")}
                                className="mt-2 flex gap-1"
                              >
                                {[1, 2, 3, 4, 5].map((value) => {
                                  const active = (order.rating ?? 0) >= value;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => rate(order.id, value)}
                                      aria-pressed={order.rating === value}
                                      aria-label={`${value} — ${pick(RATING_LABEL[value], lang)}`}
                                      className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    >
                                      <Star
                                        className={`h-5 w-5 ${
                                          active
                                            ? "fill-amber-400 text-amber-400"
                                            : "text-muted-foreground/40"
                                        }`}
                                        aria-hidden="true"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                              {order.rating && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {pick(RATING_LABEL[order.rating], lang)}
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </AnimatedSection>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </Layout>
  );
}
