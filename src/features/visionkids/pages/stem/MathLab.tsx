import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function MathLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="math" emoji="➗" title={t("kids.stem.lab.math.title")} subtitle={t("kids.stem.lab.math.subtitle")} canonicalPath="/kids/stem/math" />;
}
