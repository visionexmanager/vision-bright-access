import { Layout } from "@/components/Layout";
import { ScrollText } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const sections = [
  "platform",
  "eligibility",
  "acceptableUse",
  "ugc",
  "marketplace",
  "vxCoins",
  "tools",
  "ai",
  "community",
  "accessibility",
  "ip",
  "thirdParty",
  "advertising",
  "availability",
  "liability",
  "termination",
  "changes",
  "law",
];

export default function TermsOfUse() {
  const { t } = useLanguage();
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ScrollText className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.terms.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">
          {t("legal.terms.intro")}
        </p>

        <div className="space-y-5">
          {sections.map((section, i) => (
            <div key={section} className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <h2 className="text-lg font-semibold text-foreground">{t(`legal.terms.${section}.title`)}</h2>
              </div>
              <p className="leading-relaxed text-muted-foreground">{t(`legal.terms.${section}.body`)}</p>
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
