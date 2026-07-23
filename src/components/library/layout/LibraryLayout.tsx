import { ReactNode } from "react";
import { LibrarySidebar } from "@/components/library/layout/LibrarySidebar";
import { LibraryHeader } from "@/components/library/layout/LibraryHeader";
import { LibraryBreadcrumb } from "@/components/library/layout/LibraryBreadcrumb";
import { ErrorBoundary } from "@/components/library/ErrorBoundary";
import type { BreadcrumbItem } from "@/components/library/Breadcrumb";

interface LibraryLayoutProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Section shell every Library page renders into. Nests INSIDE the existing
 * global Layout (Navbar/Footer/skip-link/#main-content) — does not replace
 * it, same relationship FinanceSidebar.tsx has to the global Layout.
 */
export function LibraryLayout({ title, breadcrumb = [], headerActions, children }: LibraryLayoutProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <LibrarySidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <LibraryHeader title={title} actions={headerActions} />
        <main className="flex-1 p-4 sm:p-6" role="region" aria-label={title}>
          <LibraryBreadcrumb items={breadcrumb} />
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
