import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMyRegistration, useRegisterForEvent, useCancelRegistration } from "@/features/visionkids/hooks/events/useRegistration";

export function RegistrationButton({ eventId }: { eventId: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: registration, isLoading } = useMyRegistration(eventId);
  const register = useRegisterForEvent();
  const cancel = useCancelRegistration();

  if (!user) {
    return <p className="text-sm text-muted-foreground">{t("kids.stories.signInRequired")}</p>;
  }

  if (isLoading) return <div className="h-10 w-32 animate-pulse rounded-xl bg-muted" aria-busy="true" />;

  if (!registration || registration.status === "cancelled") {
    return (
      <Button className="bg-kids-primary text-white hover:bg-kids-primary/90" onClick={() => register.mutate(eventId)} disabled={register.isPending}>
        {t("kids.events.register")}
      </Button>
    );
  }

  if (registration.parental_approval_status === "pending") {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-kids-accent/40 bg-kids-accent/10 px-3 py-2 text-sm font-semibold text-kids-accent">
        <Clock className="h-4 w-4" aria-hidden="true" /> {t("kids.events.awaitingParentApproval")}
      </div>
    );
  }

  if (registration.parental_approval_status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
        <XCircle className="h-4 w-4" aria-hidden="true" /> {t("kids.events.parentDenied")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2 rounded-xl border-2 border-kids-green/40 bg-kids-green/10 px-3 py-2 text-sm font-semibold text-kids-green">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {registration.status === "waitlisted" ? t("kids.events.waitlisted") : t("kids.events.registered")}
      </span>
      <Button variant="outline" size="sm" onClick={() => cancel.mutate(registration.id)} disabled={cancel.isPending}>
        {t("kids.events.cancelRegistration")}
      </Button>
    </div>
  );
}
