import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const handleShare = async () => {
    const shareUrl = url ?? window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // User cancelled the native share sheet — no action needed.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${shareUrl}`);
      toast({ title: "تم النسخ", description: "تم نسخ رابط المشاركة إلى الحافظة" });
    } catch {
      toast({ title: "تعذّر النسخ", description: "حاول مرة أخرى", variant: "destructive" });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 rounded-xl">
      <Share2 className="w-4 h-4" aria-hidden="true" />
      مشاركة
    </Button>
  );
}
