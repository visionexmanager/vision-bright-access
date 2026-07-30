import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Discover() {
  const { t } = useLanguage();
  return <ProductListPage emoji="🔎" title={t("kids.market.nav.discover")} subtitle={t("kids.market.discover.subtitle")} canonicalPath="/kids/market/discover" />;
}
