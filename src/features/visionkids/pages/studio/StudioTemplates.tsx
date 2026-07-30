import { Link } from "react-router-dom";
import { LayoutTemplate, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { STUDIO_TOOLS } from "@/features/visionkids/data/studioTools";

export default function StudioTemplates() {
  const { t } = useLanguage();

  useDocumentHead({ title: t("kids.studio.templatesTitle"), description: t("kids.studio.meta.description"), canonicalPath: "/kids/studio/templates" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <LayoutTemplate className="h-7 w-7 text-kids-primary" aria-hidden="true" /> {t("kids.studio.templatesTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.studio.templatesSubtitle")}</p>

      <div className="mt-6 flex flex-col gap-2">
        {STUDIO_TOOLS.map((tool) => (
          <Link key={tool.type} to={tool.slug} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 transition-colors hover:border-kids-primary/50">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{tool.emoji}</span>
              <div>
                <p className="font-semibold">{t(tool.titleKey)}</p>
                <p className="text-sm text-muted-foreground">{t(`kids.studio.startIdea.${tool.type}`)}</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
