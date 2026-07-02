import { useCallback } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";

// Career Center is UI-only for now — every action surfaces this instead of a real request.
export function useComingSoon() {
  const { t } = useLanguage();
  const { playSound } = useSound();

  return useCallback(() => {
    playSound("click");
    toast.info(t("careerCenter.comingSoon"));
  }, [playSound, t]);
}
