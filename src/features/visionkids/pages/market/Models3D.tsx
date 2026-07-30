import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Models3D() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="model3d" emoji="🧊" title={t("kids.market.nav.models3d")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/3d-models" />;
}
