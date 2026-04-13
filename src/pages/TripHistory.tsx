import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Star, MapPin, Car, Package, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TripRecord {
  id: string;
  created_at: string;
  rating: number;
  comment: string | null;
  driver_name: string;
  service_type: string;
  pickup_location: string | null;
  destination_location: string | null;
}

export default function TripHistory() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchTrips = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("driver_ratings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setTrips(data || []);
      setLoading(false);
    };
    fetchTrips();
  }, [user]);

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-lg text-muted-foreground">{t("tripHistory.loginRequired")}</p>
          <Button onClick={() => navigate("/login")}>{t("nav.login")}</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="section-container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">
            {t("tripHistory.title")}
          </h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/services/delivery")}>
            {t("tripHistory.newTrip")}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t("tripHistory.empty")}</p>
            <Button onClick={() => navigate("/services/delivery")}>
              {t("tripHistory.bookNow")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {trip.service_type === "ride" ? (
                      <Car className="h-5 w-5 text-primary" />
                    ) : (
                      <Package className="h-5 w-5 text-primary" />
                    )}
                    <span className="font-bold text-foreground">{trip.driver_name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < trip.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Locations */}
                <div className="space-y-1 text-sm">
                  {trip.pickup_location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{trip.pickup_location}</span>
                    </div>
                  )}
                  {trip.destination_location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
                      <span className="truncate">{trip.destination_location}</span>
                    </div>
                  )}
                </div>

                {/* Comment */}
                {trip.comment && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                    <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{trip.comment}</span>
                  </div>
                )}

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(trip.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
