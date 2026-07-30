import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { staggerContainer } from "@/features/visionkids/utils/animations";
import { useSubjects } from "@/features/visionkids/hooks/academy/useAcademyCatalog";
import { SubjectCard } from "@/features/visionkids/components/academy/SubjectCard";

export default function Subjects() {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();
  const { data: subjects = [], isLoading } = useSubjects();

  useDocumentHead({ title: t("kids.academy.subjectsTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/subjects" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">{t("kids.academy.subjectsTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("kids.academy.subjectsSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer(reduced)} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {subjects.map((subject) => <SubjectCard key={subject.id} subject={subject} />)}
        </motion.div>
      )}
    </div>
  );
}
