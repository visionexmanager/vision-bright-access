import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Music() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="music" emoji="🎵" title={t("kids.market.nav.music")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/music" />;
}
