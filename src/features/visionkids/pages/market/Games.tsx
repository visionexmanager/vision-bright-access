import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Games() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="game" emoji="🎮" title={t("kids.market.nav.games")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/games" />;
}
