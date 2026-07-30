import { useLanguage } from "@/contexts/LanguageContext";
import { LabExperimentsPage } from "@/features/visionkids/components/stem/LabExperimentsPage";

export default function PhysicsLab() {
  const { t } = useLanguage();
  return <LabExperimentsPage lab="physics" emoji="🧲" title={t("kids.stem.lab.physics.title")} subtitle={t("kids.stem.lab.physics.subtitle")} canonicalPath="/kids/stem/physics" />;
}
