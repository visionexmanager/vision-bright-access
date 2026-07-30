import { Link } from "react-router-dom";
import { Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyCertificates } from "@/features/visionkids/hooks/academy/useAcademyCertificates";
import { CertificateCard } from "@/features/visionkids/components/academy/CertificateCard";

export default function Certificates() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: certificates = [], isLoading } = useMyCertificates();

  useDocumentHead({ title: t("kids.academy.certificatesTitle"), description: t("kids.academy.meta.description"), canonicalPath: "/kids/academy/certificates" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Award className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold">
        <Award className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.academy.certificatesTitle")}
      </h1>

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-busy="true">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : certificates.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.academy.noCertificatesYet")}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {certificates.map((c) => <CertificateCard key={c.id} certificate={c} />)}
        </div>
      )}
    </div>
  );
}
