import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function SpaceEngineering() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="space" emoji="🚀" title={t("kids.stem.lab.space.title")} subtitle={t("kids.stem.lab.space.subtitle")} canonicalPath="/kids/stem/space" />;
}
