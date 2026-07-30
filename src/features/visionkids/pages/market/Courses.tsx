import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function Courses() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="course" emoji="🎓" title={t("kids.market.nav.courses")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/courses" />;
}
