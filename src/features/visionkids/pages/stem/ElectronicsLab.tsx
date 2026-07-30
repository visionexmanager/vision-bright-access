import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function ElectronicsLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="electronics" emoji="💡" title={t("kids.stem.lab.electronics.title")} subtitle={t("kids.stem.lab.electronics.subtitle")} canonicalPath="/kids/stem/electronics" />;
}
