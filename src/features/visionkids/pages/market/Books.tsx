import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Books() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="book" emoji="📕" title={t("kids.market.nav.books")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/books" />;
}
