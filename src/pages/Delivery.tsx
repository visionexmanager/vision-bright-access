import { useState, useMemo, lazy, Suspense, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Truck, Car, Bike, ArrowLeftRight, Clock,
  ShieldCheck, Bell, PhoneCall, Star, MapPin, History,
  Banknote, CreditCard, Share2, CalendarIcon
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const DeliveryMap = lazy(() => import("@/components/DeliveryMap"));
const LocationPickerMap = lazy(() => import("@/components/LocationPickerMap"));
const DriverRating = lazy(() => import("@/components/DriverRating"));

const speak = (text: string, lang: string) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "ar" ? "ar-SA" : lang;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
};

type ServiceType = "ride" | "package";
type Status = "idle" | "searching" | "tracking" | "completed";
type SelectionStep = "pickup" | "destination";
type PaymentMethod = "cash" | "card";

export default function Delivery() {
  const { t, lang } = useLanguage();
  const [serviceType, setServiceType] = useState<ServiceType>("ride");
  const [status, setStatus] = useState<Status>("idle");
  const [location, setLocation] = useState({ from: "", to: "" });
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectionStep, setSelectionStep] = useState<SelectionStep>("pickup");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("09:00");

  const prevStatusRef = useRef<Status>(status);
  useEffect(() => {
    if (prevStatusRef.current === status) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "searching") {
      toast(t("delivery.notif.searching"), { icon: "🔍", description: t("delivery.notif.searchingDesc") });
    } else if (status === "tracking") {
      toast.success(t("delivery.notif.driverFound"), { description: t("delivery.notif.driverFoundDesc") });
      // Simulate mid-trip notifications
      setTimeout(() => toast(t("delivery.notif.arriving"), { icon: "📍", description: t("delivery.notif.arrivingDesc") }), 8000);
    } else if (status === "completed") {
      toast.success(t("delivery.notif.completed"), { description: t("delivery.notif.completedDesc") });
    } else if (status === "idle" && prev === "tracking") {
      toast.error(t("delivery.notif.cancelled"), { description: t("delivery.notif.cancelledDesc") });
    }
  }, [status, t]);

  const tripInfo = useMemo(() => {
    if (!pickupCoords || !destCoords) return null;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const [lat1, lon1] = pickupCoords;
    const [lat2, lon2] = destCoords;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const baseFare = serviceType === "ride" ? 2.0 : 3.0;
    const perKm = serviceType === "ride" ? 1.5 : 2.0;
    const price = Math.max(baseFare + dist * perKm, baseFare);
    const minutes = Math.max(Math.round(dist * 3), 5); // ~3 min/km avg
    return { distance: dist, price, minutes };
  }, [pickupCoords, destCoords, serviceType]);

  const startService = () => {
    setStatus("searching");
    speak(t("delivery.searching").replace("{from}", location.from), lang);
    setTimeout(() => {
      setStatus("tracking");
      speak(t("delivery.confirmed"), lang);
    }, 3000);
  };

  const handlePickupSet = (coords: [number, number], label: string) => {
    setPickupCoords(coords);
    setLocation((prev) => ({ ...prev, from: label }));
    setSelectionStep("destination");
  };

  const handleDestinationSet = (coords: [number, number], label: string) => {
    setDestCoords(coords);
    setLocation((prev) => ({ ...prev, to: label }));
  };

  return (
    <Layout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <header className="bg-foreground p-6 text-background shadow-2xl sticky top-0 z-40 rounded-b-[40px]">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary rounded-2xl animate-pulse">
                <Truck size={28} />
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter">
                Vision Ex <span className="text-primary text-sm">Express</span>
              </h1>
            </div>
            <div className="hidden md:flex gap-4 bg-background/10 p-2 rounded-2xl border border-background/10">
              <button
                onClick={() => setServiceType("ride")}
                className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${
                  serviceType === "ride"
                    ? "bg-background text-foreground shadow-lg"
                    : "text-background/60"
                }`}
              >
                {t("delivery.rideService")}
              </button>
              <button
                onClick={() => setServiceType("package")}
                className={`px-6 py-2 rounded-xl font-black text-sm transition-all ${
                  serviceType === "package"
                    ? "bg-background text-foreground shadow-lg"
                    : "text-background/60"
                }`}
              >
                {t("delivery.packageService")}
              </button>
            </div>
            <Link
              to="/services/trip-history"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            >
              <History className="w-4 h-4" />
              {t("delivery.tripHistory")}
            </Link>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-10">
          {status === "idle" && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-700">
              {/* Map picker */}
              <Suspense fallback={<div className="w-full h-64 md:h-80 bg-muted rounded-3xl animate-pulse" />}>
                <LocationPickerMap
                  pickupCoords={pickupCoords}
                  destinationCoords={destCoords}
                  selectionStep={selectionStep}
                  onPickupSet={handlePickupSet}
                  onDestinationSet={handleDestinationSet}
                />
              </Suspense>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Service selector */}
                <div className="lg:col-span-4 space-y-4">
                  <h2 className="text-3xl font-black text-foreground mb-6 italic">
                    {t("delivery.whereToday")}
                  </h2>
                  <div
                    onClick={() => setServiceType("ride")}
                    className={`p-6 rounded-[35px] border-4 transition-all cursor-pointer shadow-xl ${
                      serviceType === "ride"
                        ? "border-primary bg-card"
                        : "border-transparent bg-muted opacity-60"
                    }`}
                  >
                    <Car size={40} className="text-primary mb-4" />
                    <h4 className="font-black text-xl text-foreground">{t("delivery.rideTitle")}</h4>
                    <p className="text-muted-foreground text-sm mt-2">{t("delivery.rideDesc")}</p>
                  </div>
                  <div
                    onClick={() => setServiceType("package")}
                    className={`p-6 rounded-[35px] border-4 transition-all cursor-pointer shadow-xl ${
                      serviceType === "package"
                        ? "border-emerald-600 bg-card"
                        : "border-transparent bg-muted opacity-60"
                    }`}
                  >
                    <Bike size={40} className="text-emerald-600 mb-4" />
                    <h4 className="font-black text-xl text-foreground">{t("delivery.packageTitle")}</h4>
                    <p className="text-muted-foreground text-sm mt-2">{t("delivery.packageDesc")}</p>
                  </div>
                </div>

                {/* Trip details */}
                <div className="lg:col-span-8 bg-card p-10 rounded-[55px] shadow-2xl border border-border relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-emerald-600" />
                  <div className="space-y-8">
                    <div className="relative border-r-4 border-dashed border-border pr-8 space-y-10 py-2 mr-4">
                      <div className="relative">
                        <div className="absolute -right-11 top-1 w-6 h-6 bg-primary rounded-full border-4 border-card shadow-lg" />
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-2">
                          {t("delivery.from")}
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={location.from}
                            onChange={(e) => setLocation({ ...location, from: e.target.value })}
                            placeholder={t("delivery.fromPlaceholder")}
                            className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto flex-1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-auto w-14 rounded-2xl shrink-0 ${selectionStep === "pickup" ? "border-primary text-primary" : ""}`}
                            onClick={() => setSelectionStep("pickup")}
                            title={t("delivery.clickPickup")}
                          >
                            <MapPin size={20} />
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute -right-11 top-1 w-6 h-6 bg-destructive rounded-full border-4 border-card shadow-lg" />
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-2">
                          {t("delivery.to")}
                        </label>
                        <div className="flex gap-2">
                          <Input
                            value={location.to}
                            onChange={(e) => setLocation({ ...location, to: e.target.value })}
                            placeholder={t("delivery.toPlaceholder")}
                            className="bg-muted p-5 rounded-2xl font-bold text-lg h-auto flex-1"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className={`h-auto w-14 rounded-2xl shrink-0 ${selectionStep === "destination" ? "border-destructive text-destructive" : ""}`}
                            onClick={() => setSelectionStep("destination")}
                            title={t("delivery.clickDestination")}
                          >
                            <MapPin size={20} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/10 p-6 rounded-3xl border border-primary/20 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4 text-foreground">
                          <Clock className="text-primary" />
                          <span className="font-black">
                            {t("delivery.estimatedTime")}: {tripInfo ? tripInfo.minutes : "--"} {t("delivery.minutes")}
                          </span>
                        </div>
                        <div className="text-2xl font-black text-foreground tracking-tighter">
                          {tripInfo ? `${tripInfo.price.toFixed(2)} $` : "-- $"}
                        </div>
                      </div>
                      {tripInfo && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>{t("delivery.distance")}: {tripInfo.distance.toFixed(1)} km</span>
                          <span className="mx-1">•</span>
                          <span>{t("delivery.baseFare")}: {serviceType === "ride" ? "2.00" : "3.00"} $</span>
                          <span className="mx-1">•</span>
                          <span>{t("delivery.perKm")}: {serviceType === "ride" ? "1.50" : "2.00"} $/km</span>
                        </div>
                      )}
                    </div>

                    {/* Payment method */}
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {t("delivery.paymentMethod")}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setPaymentMethod("cash")}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 font-bold transition-all ${
                            paymentMethod === "cash"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <Banknote className="w-5 h-5" />
                          {t("delivery.cash")}
                        </button>
                        <button
                          onClick={() => setPaymentMethod("card")}
                          className={`flex items-center gap-3 p-4 rounded-2xl border-2 font-bold transition-all ${
                            paymentMethod === "card"
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <CreditCard className="w-5 h-5" />
                          {t("delivery.card")}
                        </button>
                      </div>
                    </div>

                      <Button
                      disabled={!location.from || !location.to}
                      className="w-full py-6 h-auto rounded-[30px] font-black text-2xl shadow-2xl flex items-center justify-center gap-4"
                      size="lg"
                    >
                      {serviceType === "ride" ? t("delivery.requestRide") : t("delivery.confirmDelivery")}
                      <ArrowLeftRight className="rotate-180" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Searching */}
          {status === "searching" && (
            <div className="flex flex-col items-center justify-center py-24 gap-6 animate-in fade-in">
              <div className="p-6 bg-primary/10 rounded-full animate-pulse">
                <Truck size={48} className="text-primary animate-bounce" />
              </div>
              <h2 className="text-2xl font-black text-foreground">{t("delivery.searchingTitle")}</h2>
              <p className="text-muted-foreground">{t("delivery.searchingDesc")}</p>
            </div>
          )}

          {/* Live Tracking */}
          {status === "tracking" && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom-20 duration-1000">
              <Suspense fallback={<div className="w-full h-80 bg-muted rounded-[30px] animate-pulse" />}>
                <DeliveryMap isTracking={true} />
              </Suspense>

              <div className="bg-card p-8 rounded-[50px] shadow-2xl border border-border flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 bg-muted rounded-[35px] overflow-hidden border-4 border-primary/10 flex items-center justify-center">
                  <Car size={40} className="text-primary" />
                </div>
                <div className="flex-1 text-center md:text-right">
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    <h3 className="text-2xl font-black text-foreground">{t("delivery.driverName")}</h3>
                    <div className="flex items-center text-orange-500 font-bold text-sm bg-orange-500/10 px-2 py-1 rounded-lg">
                      <Star size={14} fill="currentColor" /> 4.9
                    </div>
                  </div>
                  <p className="text-muted-foreground font-bold mt-1">{t("delivery.driverCar")}</p>
                  <div className="mt-4 flex gap-3 justify-center md:justify-start">
                    <button
                      onClick={() => speak(t("delivery.callingDriver"), lang)}
                      className="p-4 bg-emerald-500/10 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all"
                    >
                      <PhoneCall />
                    </button>
                    <Button variant="outline" className="rounded-2xl font-black px-6 py-4 h-auto">
                      {t("delivery.sendMessage")}
                    </Button>
                  </div>
                </div>
                <div className="text-center p-6 bg-primary/10 rounded-[40px] border border-primary/20 min-w-[150px]">
                  <p className="text-xs font-black text-primary uppercase mb-1">{t("delivery.arrivingIn")}</p>
                  <span className="text-4xl font-black text-foreground italic tracking-tighter">04</span>
                  <span className="text-lg font-black text-foreground italic mr-1"> {t("delivery.minutes")}</span>
                </div>
              </div>

              <Button
                onClick={() => setStatus("completed")}
                className="w-full py-4 h-auto rounded-2xl font-black text-lg gap-2"
              >
                {t("delivery.completeTrip")}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/services/shared-trip?from=${encodeURIComponent(location.from)}&to=${encodeURIComponent(location.to)}&service=${serviceType}&eta=4`;
                    if (navigator.share) {
                      navigator.share({ title: t("sharedTrip.title"), url: shareUrl });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      speak(t("sharedTrip.linkCopied"), lang);
                    }
                  }}
                  variant="outline"
                  className="py-4 h-auto rounded-2xl font-black text-lg gap-2"
                >
                  <Share2 className="w-5 h-5" />
                  {t("sharedTrip.share")}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setStatus("idle")}
                  className="py-4 h-auto rounded-2xl font-black text-lg text-destructive border-destructive/30 hover:bg-destructive hover:text-white transition-all"
                >
                  {t("delivery.cancelOrder")}
                </Button>
              </div>
            </div>
          )}

          {/* Rating */}
          {status === "completed" && (
            <div className="py-10 animate-in fade-in">
              <Suspense fallback={<div className="w-full h-40 bg-muted rounded-3xl animate-pulse" />}>
                <DriverRating
                  driverName={t("delivery.driverName")}
                  pickupLocation={location.from}
                  destinationLocation={location.to}
                  serviceType={serviceType}
                  onComplete={() => setStatus("idle")}
                />
              </Suspense>
            </div>
          )}
        </main>

        <footer className="fixed bottom-6 w-full px-6 flex justify-between items-center pointer-events-none z-50">
          <button className="p-5 bg-card text-primary rounded-full shadow-2xl border border-border pointer-events-auto hover:scale-110 active:rotate-12 transition-all">
            <ShieldCheck size={32} />
          </button>
          <button
            onClick={() => speak(t("delivery.helpVoice"), lang)}
            className="p-5 bg-foreground text-background rounded-full shadow-2xl pointer-events-auto hover:scale-110 transition-all"
          >
            <Bell size={32} />
          </button>
        </footer>
      </div>
    </Layout>
  );
}
