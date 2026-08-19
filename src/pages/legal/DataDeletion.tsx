// Public data-deletion instructions.
//
// Meta requires every app handling platform data to publish either a deletion
// callback endpoint or a public instructions URL. This is the instructions URL,
// and it is a standalone route rather than a card inside /legal on purpose: a
// reviewer opens the link and must land on the instructions themselves.
//
// Everything here describes a process Visionex can actually carry out. Someone
// who messages the Page on Messenger has no Visionex account to sign into and
// no session to authenticate, so there is no self-service button to offer them
// — and claiming one would be the kind of promise this page exists to avoid.

import { Layout } from "@/components/Layout";
import { Trash2, MessageSquare, Clock, UserCog, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const STEPS = ["step1", "step2", "step3"] as const;

const SECTIONS = [
  { key: "what", icon: MessageSquare },
  { key: "timing", icon: Clock },
  { key: "account", icon: UserCog },
] as const;

export default function DataDeletion() {
  const { t } = useLanguage();

  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Trash2 className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t("legal.dataDeletion.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("legal.updated")}</p>
          </div>
        </div>

        <p className="mb-8 leading-relaxed text-muted-foreground">{t("legal.dataDeletion.intro")}</p>

        <div className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold">{t("legal.dataDeletion.howTitle")}</h2>
          <ol className="space-y-4">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`legal.dataDeletion.${step}`)}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {t("legal.dataDeletion.contact")}
            <a
              href="mailto:hello@visionex.app?subject=Data%20deletion%20request"
              className="font-semibold text-primary underline underline-offset-4"
            >
              hello@visionex.app
            </a>
          </p>
        </div>

        {SECTIONS.map(({ key, icon: Icon }) => (
          <div key={key} className="mb-8 rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              {t(`legal.dataDeletion.${key}Title`)}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`legal.dataDeletion.${key}Body`)}
            </p>
          </div>
        ))}

        <div className="mt-10 rounded-2xl border bg-primary/5 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {t("legal.dataDeletion.footer")}{" "}
            <Link to="/privacy-policy" className="font-semibold text-primary underline underline-offset-4">
              {t("legal.privacy.title")}
            </Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
