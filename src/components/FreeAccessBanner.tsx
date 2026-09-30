import { Shield } from "lucide-react";
import { useFreeAccess } from "@/hooks/useFreeAccess";
import { useAuth } from "@/contexts/AuthContext";

interface FreeAccessBannerProps {
  serviceName?: string;
  className?: string;
}

export function FreeAccessBanner({ serviceName = "this service", className }: FreeAccessBannerProps) {
  const { user } = useAuth();
  const { isAdmin, hasFreeAccess } = useFreeAccess();

  if (!user || !hasFreeAccess || !isAdmin) return null;

  // Admins only. The free week is not free access to anything — see useFreeAccess.
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-xs border-b bg-violet-500/10 border-violet-500/20 text-violet-400 ${className ?? ""}`}>
      <Shield className="size-3.5 shrink-0" />
      <span>
        <span className="font-semibold">Admin Access</span> — {serviceName} is free forever for admins.
      </span>
    </div>
  );
}
