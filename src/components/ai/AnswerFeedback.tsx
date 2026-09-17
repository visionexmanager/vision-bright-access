import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

type Rating = "thumbs_up" | "thumbs_down";

/**
 * Two buttons under an assistant answer. The rating is a quality signal only:
 * the database keeps a salted fingerprint of the question and, for a negative
 * rating, a redacted excerpt — never the account, and never the answer. Nothing
 * the assistant says changes because of it until a person has reviewed it.
 */
export function AnswerFeedback({ question, assistantId }: { question: string; assistantId?: string }) {
  const { t } = useLanguage();
  const [rating, setRating] = useState<Rating | null>(null);
  const [sending, setSending] = useState(false);

  const rate = async (value: Rating) => {
    if (rating || sending) return;
    setSending(true);
    const { error } = await supabase.rpc("record_ai_signal", {
      _signal: value,
      _channel: "website",
      _assistant_id: assistantId ?? "visionex",
      _question: question.slice(0, 500),
    });
    setSending(false);
    if (!error) setRating(value);
  };

  const button = (value: Rating, label: string, Icon: typeof ThumbsUp) => (
    <button
      type="button"
      onClick={() => void rate(value)}
      disabled={sending || (rating !== null && rating !== value)}
      aria-pressed={rating === value}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 aria-pressed:text-primary"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );

  return (
    <div role="group" aria-label={t("ai.feedback.group")} className="mt-1 flex items-center gap-1">
      {button("thumbs_up", t("ai.feedback.helpful"), ThumbsUp)}
      {button("thumbs_down", t("ai.feedback.notHelpful"), ThumbsDown)}
      <span role="status" className="text-xs text-muted-foreground">
        {rating ? t("ai.feedback.thanks") : ""}
      </span>
    </div>
  );
}
