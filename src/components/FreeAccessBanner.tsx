import { Shield, Sparkles } from "lucide-react";
import { useFreeAccess } from "@/hooks/useFreeAccess";
import { useAuth } from "@/contexts/AuthContext";

interface FreeAccessBannerProps {
  serviceName?: string;
  className?: string;
}

export function FreeAccessBanner({ serviceName = "this service", className }: FreeAccessBannerProps) {
  const { user } = useAuth();
  const { isAdmin, isNewUser, hasFreeAccess, daysRemaining } = useFreeAccess();

  if (!user || !hasFreeAccess) return null;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs border-b ${
      isAdmin
        ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    } ${className ?? ""}`}>
      {isAdmin ? (
        <>
          <Shield className="size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Admin Access</span> — {serviceName} is free forever for admins.
          </span>
        </>
      ) : (
        <>
          <Sparkles className="size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Free for {daysRemaining} more {daysRemaining === 1 ? "day" : "days"}</span> — enjoy full access during your 30-day welcome period.
          </span>
        </>
      )}
    </div>
  );
}
