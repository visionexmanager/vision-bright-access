import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSimulationPause } from "@/contexts/SimulationPauseContext";

/**
 * The one pause switch for a running simulation.
 *
 * The button's name changes between Pause and Resume rather than carrying a
 * pressed state as well: a screen reader then says one thing, not two. The
 * notice is a polite live region that is present from the start, so setting its
 * text is announced; it is empty again on resume, because the button has already
 * told the person what it now does.
 */
export function SimulationPauseControl() {
  const { t } = useLanguage();
  const { paused, toggle } = useSimulationPause();
  const Icon = paused ? Play : Pause;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={toggle}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {paused ? t("bsim.resume") : t("bsim.pause")}
      </Button>
      <p role="status" className={paused ? "basis-full text-sm font-medium text-primary" : "sr-only"}>
        {paused ? t("bsim.pausedNotice") : ""}
      </p>
    </>
  );
}
