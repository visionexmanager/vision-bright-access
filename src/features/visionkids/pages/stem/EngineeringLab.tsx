import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function EngineeringLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="engineering" emoji="🏗️" title={t("kids.stem.lab.engineering.title")} subtitle={t("kids.stem.lab.engineering.subtitle")} canonicalPath="/kids/stem/engineering" />;
}
