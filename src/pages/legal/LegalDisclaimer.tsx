import { Layout } from "@/components/Layout";
import { TriangleAlert } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const clauses = [
  "purpose",
  "advice",
  "ai",
  "marketplace",
  "finance",
  "vx",
  "ugc",
  "fileTools",
  "thirdParty",
  "accessibility",
  "liability",
  "availability",
  "law",
  "noAffiliation",
  "contact",
];

export default function LegalDisclaimer() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <TriangleAlert className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.disclaimer.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border bg-amber-500/5 border-amber-500/30 p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-amber-600 dark:text-amber-400">{t("legal.disclaimer.important")}</strong> {t("legal.disclaimer.intro")}
          </p>
        </div>

        <div className="space-y-4">
          {clauses.map((clause, i) => (
            <div key={clause} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <h2 className="font-semibold text-foreground">{t(`legal.disclaimer.${clause}.title`)}</h2>
              </div>
              <p className="leading-relaxed text-sm text-muted-foreground">{t(`legal.disclaimer.${clause}.body`)}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.inquiries")}{" "}
            <a href="mailto:hello@visionex.app" className="font-semibold text-primary underline underline-offset-4">
              hello@visionex.app
            </a>
          </p>
        </div>
      </section>
    </Layout>
  );
}
