import { BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePollVotes, useCastVote } from "@/features/visionkids/hooks/events/useLiveFeatures";
import type { KidsEventPoll } from "@/features/visionkids/types/events.types";

export function LivePollWidget({ poll }: { poll: KidsEventPoll }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: votes = [] } = usePollVotes(poll.id);
  const castVote = useCastVote(poll.id);

  const myVote = votes.find((v) => v.user_id === user?.id);
  const total = votes.length;
  const counts = poll.options.map((_, i) => votes.filter((v) => v.option_index === i).length);

  return (
    <div className="rounded-2xl border-2 border-kids-primary/40 bg-kids-primary/5 p-4">
      <p className="flex items-center gap-2 font-heading font-bold"><BarChart3 className="h-4 w-4 text-kids-primary" aria-hidden="true" /> {poll.question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {poll.options.map((option, i) => {
          const percent = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
          const isMine = myVote?.option_index === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!!myVote || !poll.is_active}
              onClick={() => castVote.mutate(i)}
              className={`relative overflow-hidden rounded-xl border-2 px-3 py-2 text-start text-sm font-semibold transition-colors disabled:cursor-default ${isMine ? "border-kids-primary" : "border-border"}`}
            >
              {myVote && <div className="absolute inset-y-0 start-0 bg-kids-primary/15" style={{ width: `${percent}%` }} aria-hidden="true" />}
              <span className="relative flex items-center justify-between">
                <span>{option}</span>
                {myVote && <span className="text-xs text-muted-foreground">{percent}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {!poll.is_active && <p className="mt-2 text-xs text-muted-foreground">{t("kids.events.live.pollClosed")}</p>}
    </div>
  );
}
