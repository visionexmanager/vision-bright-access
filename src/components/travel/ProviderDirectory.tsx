/**
 * The official sites a traveller can book on without us.
 *
 * Shown under each request form: the form is the route that reaches a person,
 * this is the route that does not need one. Each entry is one link with the
 * service's name, its country and a spoken warning that it leaves the site.
 */

import { ExternalLink } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { providersFor, type ProviderKind } from "@/features/travel/providers";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function ProviderDirectory({ kind }: { kind: ProviderKind }) {
  const { t, lang } = useLanguage();
  const headingId = `travel-directory-${kind}`;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="text-xl font-semibold">
        {t("travel.directory.title")}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">{t("travel.directory.lead")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {providersFor(kind).map((provider) => (
          <li key={provider.id} className="flex flex-col gap-1 rounded-lg border border-border p-4">
            <h3 className="text-base font-semibold">{provider.name}</h3>
            <p className="text-sm text-muted-foreground">{countryName(provider.country, lang)}</p>
            <a
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline ${focusRing}`}
            >
              {t("sourcing.vendors.official")}: {provider.name}
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{t("sourcing.vendors.newTab")}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
