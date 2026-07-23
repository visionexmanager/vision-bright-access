import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceSearchDictation } from "@/hooks/library/useVoiceSearchDictation";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface VoiceSearchButtonProps {
  onResult: (transcript: string) => void;
  className?: string;
}

export function VoiceSearchButton({ onResult, className }: VoiceSearchButtonProps) {
  const { t } = useLanguage();
  const { supported, isListening, listen, stop } = useVoiceSearchDictation();

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={isListening ? "default" : "outline"}
      size="icon"
      className={cn(className)}
      aria-pressed={isListening}
      aria-label={isListening ? t("library.search.voiceListening") : t("library.search.voiceSearch")}
      onClick={() => (isListening ? stop() : listen(onResult))}
    >
      {isListening ? <MicOff className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
