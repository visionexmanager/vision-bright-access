import { Link } from "react-router-dom";
import { ChevronLeft, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useMyEventCertificates } from "@/features/visionkids/hooks/events/useCertificates";
import { EventCertificateCard } from "@/features/visionkids/components/events/EventCertificateCard";

export default function EventCertificates() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: certificates = [], isLoading } = useMyEventCertificates();

  useDocumentHead({ title: `${t("kids.events.rewards.certificates")} — VisionKids`, description: t("kids.events.meta.description"), canonicalPath: "/kids/events/certificates" });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-lg font-semibold">{t("kids.stories.signInRequired")}</p>
        <Link to="/login" className="mt-2 inline-block text-kids-primary hover:underline">{t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link to="/kids/events/rewards" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t("kids.events.nav.rewards")}
      </Link>

      <h1 className="flex items-center gap-2 font-heading text-3xl font-extrabold"><Award className="h-7 w-7 text-kids-accent" aria-hidden="true" /> {t("kids.events.rewards.certificates")}</h1>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : certificates.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.events.rewards.noCertificates")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {certificates.map((c) => <EventCertificateCard key={c.id} certificate={c} />)}
        </div>
      )}
    </div>
  );
}
