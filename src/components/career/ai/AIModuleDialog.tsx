import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { SkeletonCard } from "@/components/career/jobs/SkeletonCard";

interface AIModuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function AIModuleDialog({ open, onOpenChange, title, icon, children }: AIModuleDialogProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
          {/* These tools still return sample output, not an analysis of what the
              user entered — said up front, and read as the dialog description. */}
          <DialogDescription>{t("aiSuite.module.sampleNotice")}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function AIModuleFallback() {
  return <SkeletonCard count={2} />;
}
