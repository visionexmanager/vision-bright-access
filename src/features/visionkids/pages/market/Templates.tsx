import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Templates() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="template" emoji="🧩" title={t("kids.market.nav.templates")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/templates" />;
}
