import { FormEvent, useState, KeyboardEvent } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import type { LibraryReviewRow } from "@/lib/types/library-review";
import type { LibraryReviewInput } from "@/services/library/reviews";

interface WriteReviewFormProps {
  existingReview: LibraryReviewRow | null;
  onSubmit: (rating: 1 | 2 | 3 | 4 | 5, comment: string | null, extra: LibraryReviewInput) => Promise<boolean> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

function TagListInput({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange([...values, trimmed]);
    setDraft("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {values.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {values.map((value, i) => (
            <Badge key={`${value}-${i}`} variant="secondary" className="gap-1">
              {value}
              <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} aria-label={`Remove ${value}`}>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={handleKeyDown} onBlur={addTag} placeholder={placeholder} />
    </div>
  );
}

export function WriteReviewForm({ existingReview, onSubmit, onCancel, isSubmitting }: WriteReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(existingReview?.rating ?? 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [pros, setPros] = useState<string[]>(existingReview?.pros ?? []);
  const [cons, setCons] = useState<string[]>(existingReview?.cons ?? []);
  const [hasSpoilers, setHasSpoilers] = useState(existingReview?.hasSpoilers ?? false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(rating, comment.trim() || null, { pros, cons, hasSpoilers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium">{t("library.reviews.yourRating")}</span>
        <div className="flex gap-1" role="radiogroup" aria-label={t("library.reviews.yourRating")}>
          {([1, 2, 3, 4, 5] as const).map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={rating === star}
              aria-label={`${star} ${t("library.reviews.stars")}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <Star
                className={cn(
                  "h-6 w-6",
                  (hoverRating || rating) >= star ? "fill-primary text-primary" : "fill-none text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="review-comment" className="mb-1.5 block text-sm font-medium">{t("library.reviews.commentLabel")}</label>
        <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TagListInput label={t("library.reviews.pros")} values={pros} onChange={setPros} placeholder={t("library.reviews.prosPlaceholder")} />
        <TagListInput label={t("library.reviews.cons")} values={cons} onChange={setCons} placeholder={t("library.reviews.consPlaceholder")} />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="review-spoiler" checked={hasSpoilers} onCheckedChange={(v) => setHasSpoilers(v === true)} />
        <Label htmlFor="review-spoiler" className="text-sm font-normal">{t("library.reviews.spoilerWarning")}</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {existingReview ? t("library.reviews.update") : t("library.reviews.submit")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("library.common.cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
