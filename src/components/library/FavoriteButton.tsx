import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  active: boolean;
  onToggle: () => void;
  className?: string;
}

export function FavoriteButton({ active, onToggle, className }: FavoriteButtonProps) {
  const { t } = useLanguage();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? t("library.actions.unfavorite") : t("library.actions.favorite")}
      className={cn("shrink-0", className)}
    >
      <Heart className={cn("h-4 w-4", active && "fill-destructive text-destructive")} aria-hidden="true" />
    </Button>
  );
}
