import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Coins, PartyPopper } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useKidsReducedMotion } from "@/features/visionkids/hooks/useKidsReducedMotion";
import { bounceIn } from "@/features/visionkids/utils/animations";

/** "You earned a reward!" celebration banner for the STEM Center. */
export function StemRewardBanner({
  show,
  message,
  xp,
  coins,
}: {
  show: boolean;
  message: string;
  xp?: number;
  coins?: number;
}) {
  const { t } = useLanguage();
  const reduced = useKidsReducedMotion();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={bounceIn(reduced)}
          className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-kids-green/40 bg-kids-green/10 p-4"
        >
          <PartyPopper className="h-8 w-8 shrink-0 text-kids-green" aria-hidden="true" />
          <div>
            <p className="font-heading font-bold text-kids-green">{message}</p>
            {(xp || coins) && (
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                {xp ? (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> +{xp} {t("kids.stem.xp")}
                  </span>
                ) : null}
                {coins ? (
                  <span className="flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" aria-hidden="true" /> +{coins}
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
