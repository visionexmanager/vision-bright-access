import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Worksheets() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="worksheet" emoji="📝" title={t("kids.market.nav.worksheets")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/worksheets" />;
}
