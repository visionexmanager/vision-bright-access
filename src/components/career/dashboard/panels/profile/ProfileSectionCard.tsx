import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { useComingSoon } from "@/components/career/useComingSoon";
import type { ReactNode } from "react";

interface ProfileSectionCardProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

export function ProfileSectionCard({ icon: Icon, title, children }: ProfileSectionCardProps) {
  const { t } = useLanguage();
  const handleAdd = useComingSoon();

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="font-bold">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleAdd}>
          <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t("careerDash.profile.add")}
        </Button>
      </div>
      {children}
    </div>
  );
}
