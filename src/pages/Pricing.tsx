import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The plans, from the table that decides them.
 *
 * Written because the WhatsApp assistant now tells somebody who has used their
 * allowance where to get more, and the address it gave them did not exist. A
 * refusal that ends in a dead link is worse than no refusal: it reads as the
 * service being broken rather than as an invitation.
 *
 * Nothing is hard-coded. `billing_plans` is the source of truth, it is public
 * by design, and an admin changing a price or an allowance changes this page
 * with it.
 */
interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_monthly_usd: number;
  vx_credits_monthly: number;
  is_unlimited: boolean;
  features: string[];
  limits: Record<string, unknown>;
  sort_order: number;
}

function asFeatures(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function Pricing() {
  const { t, translateText, dir } = useLanguage();
  const { user } = useAuth();

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase
        .from("billing_plans")
        .select("id, name, description, price_monthly_usd, vx_credits_monthly, is_unlimited, features, limits, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        features: asFeatures(row.features),
        limits: (row.limits ?? {}) as Record<string, unknown>,
      })) as Plan[];
    },
  });

  /** The WhatsApp allowance, which is the reason most readers arrive here. */
  const whatsappDaily = (plan: Plan): number | null => {
    const value = plan.limits?.whatsapp_daily_messages;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return (
    <Layout>
      <main className="mx-auto max-w-6xl px-4 py-12" dir={dir}>
        <h1 className="text-3xl font-black md:text-4xl">{translateText("Plans and pricing")}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {translateText(
            "Every plan includes the Visionex assistant on WhatsApp and on the site. The difference is how much you can ask for in a day.",
          )}
        </p>

        {isLoading ? (
          <p className="mt-10" role="status">{t("common.loading")}</p>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4" role="list">
            {plans.map((plan) => {
              const daily = whatsappDaily(plan);
              return (
                <li
                  key={plan.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <h2 className="text-xl font-bold">{translateText(plan.name)}</h2>

                  <p className="mt-2 text-3xl font-black">
                    {plan.price_monthly_usd > 0
                      ? `$${plan.price_monthly_usd}`
                      : translateText("Free")}
                    {plan.price_monthly_usd > 0 && (
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {translateText("month")}
                      </span>
                    )}
                  </p>

                  {plan.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{translateText(plan.description)}</p>
                  )}

                  {/* The number somebody arriving from WhatsApp came to find. */}
                  {daily !== null && (
                    <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm font-semibold">
                      {daily === 0
                        ? translateText("WhatsApp: no daily limit")
                        : `${translateText("WhatsApp")}: ${daily.toLocaleString()} ${translateText("requests a day")}`}
                    </p>
                  )}

                  <ul className="mt-4 space-y-2 text-sm" role="list">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                        <span>{translateText(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 pt-2">
                    <Button asChild className="w-full">
                      <Link to={user ? "/services/ai-media-studio/billing" : "/signup"}>
                        {plan.price_monthly_usd > 0
                          ? translateText("Choose this plan")
                          : translateText("Start free")}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <section className="mt-12 rounded-2xl border border-border p-6" aria-labelledby="whatsapp-plans">
          <h2 id="whatsapp-plans" className="text-lg font-bold">
            {translateText("Using your plan on WhatsApp")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {translateText(
              "Link your number once from WhatsApp — send \"link\" and type the code we email you — and your plan applies there too. Ask \"my plan\" any time to hear what is left today.",
            )}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {translateText(
              "Menus, the weather, where you are, what is nearby and finding a place never count against your allowance.",
            )}
          </p>
        </section>
      </main>
    </Layout>
  );
}
