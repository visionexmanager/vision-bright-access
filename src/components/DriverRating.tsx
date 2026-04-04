import { useState } from "react";
import { Star, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DriverRatingProps {
  driverName: string;
  pickupLocation: string;
  destinationLocation: string;
  serviceType: string;
  onComplete: () => void;
}

export default function DriverRating({
  driverName,
  pickupLocation,
  destinationLocation,
  serviceType,
  onComplete,
}: DriverRatingProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitRating = async () => {
    if (rating === 0) return;
    setSubmitting(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({ title: t("delivery.ratingLoginRequired"), variant: "destructive" });
      setSubmitting(false);
      onComplete();
      return;
    }

    const { error } = await supabase.from("driver_ratings" as any).insert({
      user_id: user.id,
      driver_name: driverName,
      rating,
      comment: comment.trim(),
      pickup_location: pickupLocation,
      destination_location: destinationLocation,
      service_type: serviceType,
    } as any);

    if (error) {
      toast({ title: t("delivery.ratingError"), variant: "destructive" });
    } else {
      toast({ title: t("delivery.ratingSuccess") });
    }

    setSubmitting(false);
    onComplete();
  };

  const ratingLabels = [
    t("delivery.ratingStar1"),
    t("delivery.ratingStar2"),
    t("delivery.ratingStar3"),
    t("delivery.ratingStar4"),
    t("delivery.ratingStar5"),
  ];

  const activeRating = hoveredStar || rating;

  return (
    <div className="max-w-lg mx-auto bg-card p-8 rounded-[40px] shadow-2xl border border-border animate-in fade-in zoom-in duration-500 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-foreground">{t("delivery.ratingTitle")}</h2>
        <p className="text-muted-foreground">{t("delivery.ratingSubtitle").replace("{driver}", driverName)}</p>
      </div>

      {/* Stars */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-1 transition-transform hover:scale-125 active:scale-95"
          >
            <Star
              size={40}
              className={`transition-colors ${
                star <= activeRating
                  ? "text-orange-400 fill-orange-400"
                  : "text-muted-foreground/30"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Rating label */}
      {activeRating > 0 && (
        <p className="text-center font-bold text-foreground animate-in fade-in">
          {ratingLabels[activeRating - 1]}
        </p>
      )}

      {/* Comment */}
      <div className="relative">
        <MessageSquare size={18} className="absolute top-4 left-4 text-muted-foreground" />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("delivery.ratingCommentPlaceholder")}
          className="w-full bg-muted rounded-2xl p-4 pl-11 min-h-[100px] resize-none text-foreground placeholder:text-muted-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          maxLength={500}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={submitRating}
          disabled={rating === 0 || submitting}
          className="flex-1 py-5 h-auto rounded-2xl font-black text-lg gap-2"
        >
          <Send size={18} />
          {submitting ? t("delivery.ratingSubmitting") : t("delivery.ratingSubmit")}
        </Button>
        <Button
          variant="outline"
          onClick={onComplete}
          className="rounded-2xl font-black px-6 py-5 h-auto"
        >
          {t("delivery.ratingSkip")}
        </Button>
      </div>
    </div>
  );
}
