import { Link } from "react-router-dom";
import { Rocket, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyProjectSubmissions } from "@/features/visionkids/hooks/academy/useAcademyAssignments";

export default function Projects() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: submissions = [], isLoading } = useMyProjectSubmissions();

  useDocumentHead({ title: t("kids.academy.projectsTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/projects" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Rocket className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Rocket className="h-7 w-7 text-kids-purple" aria-hidden="true" /> {t("kids.academy.projectsTitle")}
      </h1>
      <p className="mt-1 text-muted-foreground">{t("kids.academy.projectsSubtitle")}</p>

      {isLoading ? (
        <div className="mt-6 flex flex-col gap-3" aria-busy="true">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : submissions.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.academy.noProjectsYet")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {submissions.map((s) => (
            <Link key={s.id} to={`/kids/academy/projects/${s.project_id}`} className="flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 hover:border-kids-purple/50">
              <div>
                <p className="font-semibold">{s.project?.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.submitted_at).toLocaleDateString()}</p>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === "graded" ? "bg-kids-green/10 text-kids-green" : "bg-kids-accent/10 text-kids-accent"}`}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {s.status === "graded" ? `${s.grade}%` : t("kids.academy.submitted")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
