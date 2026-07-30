import { useLanguage } from "@/contexts/LanguageContext";
import { ProductListPage } from "@/features/visionkids/components/market/ProductListPage";

export default function AIPrompts() {
  const { t } = useLanguage();
  return <ProductListPage fixedType="prompt" emoji="💬" title={t("kids.market.nav.aiPrompts")} subtitle={t("kids.market.typeBrowse")} canonicalPath="/kids/market/ai-prompts" />;
}
