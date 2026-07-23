import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function BookmarkButton({ active, onToggle, className }: BookmarkButtonProps) {
  const { t } = useLanguage();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? t("library.actions.removeFromShelf") : t("library.actions.addToShelf")}
      className={cn("shrink-0", className)}
    >
      {active ? <BookmarkCheck className="h-4 w-4 text-primary" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
