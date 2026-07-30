import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function ChemistryLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="chemistry" emoji="⚗️" title={t("kids.stem.lab.chemistry.title")} subtitle={t("kids.stem.lab.chemistry.subtitle")} canonicalPath="/kids/stem/chemistry" />;
}
