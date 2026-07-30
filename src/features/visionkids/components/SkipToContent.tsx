import { useLanguage } from "@/contexts/LanguageContext";

export function SkipToContent() {
  const { t } = useLanguage();
  return (
    <a href="#kids-main-content" className="skip-link" aria-label={t("kids.a11y.skipToContent")}>
      {t("kids.a11y.skipToContent")}
    </a>
  );
}
