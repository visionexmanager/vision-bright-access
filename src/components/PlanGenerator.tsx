/**
 * PlanGenerator — render a small form (from config) and produce a structured
 * plan via a registry-driven generator (training-plan, travel-itinerary, …).
 * Renders the universal GeneratedPlan schema.
 */
import { useState } from "react";
import { Sparkles, Loader2, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { aiService } from "@/services/ai/aiService";
import type { GeneratedPlan } from "@/lib/types";
import type { GeneratorCapability, GeneratorField } from "@/services/ai/serviceCapabilities";

interface Props {
  capability: GeneratorCapability;
}

export function PlanGenerator({ capability }: Props) {
  const { lang, t, dir, translateText } = useLanguage();
  const isRTL = dir === "rtl";

  const [form, setForm] = useState<Record<string, string>>(() => {
    // Pre-select the first option for select fields.
    const init: Record<string, string> = {};
    for (const f of capability.fields) {
      if (f.type === "select" && f.options?.length) init[f.key] = f.options[0].value;
    }
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  const tx = {
    generate: t("ai.plan.generate"),
    generating: t("ai.plan.generating"),
    tips: t("ai.plan.tips"),
    fillRequired: t("ai.plan.fillRequired"),
    failed: t("ai.plan.failed"),
  };

  const label = (f: GeneratorField) => translateText(f.labelEn);
  const placeholder = (f: GeneratorField) => f.placeholderEn ? translateText(f.placeholderEn) : "";

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const generate = async () => {
    if (loading) return;
    const missing = capability.fields.some((f) => f.required && !form[f.key]?.trim());
    if (missing) { toast.error(tx.fillRequired); return; }

    setLoading(true);
    setPlan(null);
    try {
      const { result } = await aiService.generatePlan(capability.generatorId, form, lang);
      setPlan(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-primary/30" dir={isRTL ? "rtl" : "ltr"}>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="font-semibold">{translateText(capability.titleEn)}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {capability.fields.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
              <label className="text-sm font-medium" htmlFor={`gen-${f.key}`}>
                {label(f)}
              </label>
              {f.type === "select" ? (
                <select
                  id={`gen-${f.key}`}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{translateText(o.labelEn)}</option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <Textarea
                  id={`gen-${f.key}`}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={placeholder(f)}
                  className="min-h-[80px]"
                />
              ) : (
                <Input
                  id={`gen-${f.key}`}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={placeholder(f)}
                />
              )}
            </div>
          ))}
        </div>

        <Button type="button" onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
          {loading ? tx.generating : tx.generate}
        </Button>

        {plan && (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4" aria-live="polite">
            <div>
              <p className="text-lg font-bold">{plan.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
            </div>

            {plan.sections?.map((s, i) => (
              <div key={i} className="rounded-lg border bg-background p-3">
                <p className="mb-1.5 text-sm font-semibold text-primary">{s.heading}</p>
                <ul className="space-y-1">
                  {s.items.map((it, j) => (
                    <li key={j} className="text-sm text-muted-foreground">• {it}</li>
                  ))}
                </ul>
              </div>
            ))}

            {plan.tips?.length > 0 && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Lightbulb className="h-4 w-4" /> {tx.tips}
                </p>
                <ul className="space-y-1">
                  {plan.tips.map((t, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {t}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
