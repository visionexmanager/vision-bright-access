import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LibraryQuickSearch } from "@/components/library/layout/LibraryQuickSearch";
import { LibraryNotifications } from "@/components/library/layout/LibraryNotifications";
import { CartButton } from "@/components/library/marketplace/CartButton";

interface LibraryHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function LibraryHeader({ title, actions }: LibraryHeaderProps) {
  const { user } = useAuth();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="flex flex-1 items-center justify-end gap-3">
        <LibraryQuickSearch />
        <CartButton />
        {actions}
        {user && <LibraryNotifications />}
      </div>
    </div>
  );
}
