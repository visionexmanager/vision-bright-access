import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLibrarianVoice } from "@/hooks/library/useLibrarianVoice";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface LibrarianVoiceButtonProps {
  motivationalSummary?: string;
}

/** Voice Commands + Voice Navigation entry point for the Librarian
 *  dashboard header — toggles the continuous command listener from
 *  useLibrarianVoice. Voice Search/Notes/Conversations live at their own
 *  point of use (AI Search input, Librarian Chat input) via the existing
 *  VoiceSearchButton, not here. */
export function LibrarianVoiceButton({ motivationalSummary = "" }: LibrarianVoiceButtonProps) {
  const { t } = useLanguage();
  const { supported, isListening, toggle } = useLibrarianVoice(motivationalSummary);

  if (!supported) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={isListening ? "default" : "outline"}
          size="icon"
          aria-pressed={isListening}
          aria-label={isListening ? t("library.librarian.voice.listening") : t("library.librarian.voice.start")}
          onClick={toggle}
        >
          {isListening ? <MicOff className={cn("h-4 w-4 animate-pulse")} aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("library.librarian.voice.hint")}</TooltipContent>
    </Tooltip>
  );
}
