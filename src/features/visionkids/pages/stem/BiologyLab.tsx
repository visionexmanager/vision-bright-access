import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function BiologyLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="biology" emoji="🧬" title={t("kids.stem.lab.biology.title")} subtitle={t("kids.stem.lab.biology.subtitle")} canonicalPath="/kids/stem/biology" />;
}
