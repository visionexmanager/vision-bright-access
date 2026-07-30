import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function ScienceLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="science" emoji="🔬" title={t("kids.stem.lab.science.title")} subtitle={t("kids.stem.lab.science.subtitle")} canonicalPath="/kids/stem/science" />;
}
