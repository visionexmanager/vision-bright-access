import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Bundles() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="bundle" emoji="🎁" title={t("kids.market.nav.bundles")} subtitle={t("kids.market.bundles.subtitle")} canonicalPath="/kids/market/bundles" />;
}
