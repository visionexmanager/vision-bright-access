import { useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { MapPin, Car, Truck, Clock, Navigation } from "lucide-react";

const DeliveryMap = lazy(() => import("@/components/DeliveryMap"));

export default function SharedTrip() {
  const { t } = useLanguage();
  const [params] = useSearchParams();

  const trip = useMemo(() => {
    const from = params.get("from") || "";
    const to = params.get("to") || "";
    const service = params.get("service") || "ride";
    const eta = params.get("eta") || "--";
    return { from, to, service, eta };
  }, [params]);

  const ServiceIcon = trip.service === "ride" ? Car : Truck;

  return (
    <Layout>
      <div className="min-h-screen pb-20">
        <header className="bg-primary text-primary-foreground p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Navigation className="w-6 h-6 animate-pulse" />
            <h1 className="text-2xl font-black">{t("sharedTrip.title")}</h1>
          </div>
          <p className="text-sm opacity-80">{t("sharedTrip.subtitle")}</p>
        </header>

        <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
          {/* Live Map */}
          <Suspense fallback={<div className="w-full h-80 bg-muted rounded-3xl animate-pulse" />}>
            <DeliveryMap isTracking={true} />
          </Suspense>

          {/* Trip Info Card */}
          <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <ServiceIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  {trip.service === "ride" ? t("delivery.rideService") : t("delivery.packageService")}
                </p>
                <div className="flex items-center gap-2 text-sm text-primary font-bold">
                  <Clock className="w-4 h-4" />
                  {t("delivery.arrivingIn")}: {trip.eta} {t("delivery.minutes")}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* From */}
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">{t("delivery.from")}</p>
                  <p className="font-bold text-foreground">{trip.from || "--"}</p>
                </div>
              </div>
              {/* Dashed line */}
              <div className="ml-[5px] w-0.5 h-6 border-l-2 border-dashed border-muted-foreground/30" />
              {/* To */}
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-destructive shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">{t("delivery.to")}</p>
                  <p className="font-bold text-foreground">{trip.to || "--"}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t("sharedTrip.poweredBy")}
          </p>
        </main>
      </div>
    </Layout>
  );
}
