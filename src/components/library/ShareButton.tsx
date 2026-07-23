import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
  /** Fired after a share/copy actually completes — e.g. for analytics
   *  logging. Not called if the user cancels the native share sheet. */
  onShared?: () => void;
}

export function ShareButton({ title, text, url, className, onShared }: ShareButtonProps) {
  const { t } = useLanguage();

  const handleShare = async () => {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
        onShared?.();
      } catch {
        // User cancelled the native share sheet — no action needed.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: t("library.share.copied"), description: t("library.share.copiedDesc") });
      onShared?.();
    } catch {
      toast({ title: t("library.share.failed"), description: t("library.share.failedDesc"), variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="icon" onClick={handleShare} aria-label={t("library.actions.share")} className={cn(className)}>
      <Share2 className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
