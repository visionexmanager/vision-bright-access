import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Videos() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="video" emoji="🎬" title={t("kids.market.nav.videos")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/videos" />;
}
