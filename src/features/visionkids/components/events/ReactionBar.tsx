import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { useIncrementEventReaction } from "@/features/visionkids/hooks/events/useEvents";

const EMOJIS = ["❤️", "😂", "👏", "🎉", "😮", "👍"];

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

/** Reactions are broadcast live via a Supabase Realtime channel (not
 *  persisted per-tap — see increment_kids_event_reaction()'s own comment
 *  on why) so every viewer sees the same floating burst; only a running
 *  total per emoji is written to the DB. */
export function ReactionBar({ eventId }: { eventId: string }) {
  const incrementReaction = useIncrementEventReaction();
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const idRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof kidsDb.channel> | null>(null);

  useEffect(() => {
    const channel = kidsDb
      .channel(`kids-event-reactions-${eventId}`)
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        spawnFloating((payload as { emoji: string }).emoji);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { kidsDb.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const spawnFloating = (emoji: string) => {
    const id = idRef.current++;
    setFloating((prev) => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    window.setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 2000);
  };

  const react = (emoji: string) => {
    spawnFloating(emoji);
    channelRef.current?.send({ type: "broadcast", event: "reaction", payload: { emoji } });
    incrementReaction.mutate({ eventId, emoji });
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-48 overflow-hidden">
        <AnimatePresence>
          {floating.map((f) => (
            <motion.span
              key={f.id}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 0, y: -160 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute bottom-0 text-2xl"
              style={{ left: `${f.x}%` }}
              aria-hidden="true"
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-2 rounded-2xl border-2 border-border bg-card p-2">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 active:scale-95"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
