import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { Loader2, Building2 } from "lucide-react";
import { useOrganization } from "@/hooks/library/useOrganization";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface OrganizationLayoutProps {
  slug: string;
  headerActions?: ReactNode;
  children: (ctx: ReturnType<typeof useOrganization>) => ReactNode;
}

const TABS = [
  { path: "", labelKey: "library.enterprise.nav.overview" },
  { path: "/members", labelKey: "library.enterprise.nav.members" },
  { path: "/groups", labelKey: "library.enterprise.nav.groups" },
  { path: "/resources", labelKey: "library.enterprise.nav.resources" },
  { path: "/permissions", labelKey: "library.enterprise.nav.permissions" },
  { path: "/licenses", labelKey: "library.enterprise.nav.licenses" },
  { path: "/assignments", labelKey: "library.enterprise.nav.assignments" },
  { path: "/analytics", labelKey: "library.enterprise.nav.analytics" },
  { path: "/security", labelKey: "library.enterprise.nav.security" },
];

export function OrganizationLayout({ slug, headerActions, children }: OrganizationLayoutProps) {
  const { t } = useLanguage();
  const location = useLocation();
  const ctx = useOrganization(slug);
  const basePath = `/library/organizations/${slug}`;

  if (ctx.isLoading) {
    return (
      <Layout>
        <LibraryLayout title={t("library.enterprise.title")} breadcrumb={[{ label: t("library.enterprise.title"), to: "/library/organizations" }]}>
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" /></div>
        </LibraryLayout>
      </Layout>
    );
  }

  if (!ctx.organization) {
    return (
      <Layout>
        <LibraryLayout title={t("library.enterprise.title")} breadcrumb={[{ label: t("library.enterprise.title"), to: "/library/organizations" }]}>
          <EmptyState icon={<Building2 className="h-10 w-10" />} title={t("library.enterprise.notFound")} className="py-16" />
        </LibraryLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <LibraryLayout
        title={ctx.organization.name}
        breadcrumb={[{ label: t("library.enterprise.title"), to: "/library/organizations" }, { label: ctx.organization.name }]}
        headerActions={headerActions}
      >
        <nav aria-label={t("library.enterprise.nav.label")} className="mb-4 flex flex-wrap gap-1 border-b">
          {TABS.map((tab) => {
            const to = `${basePath}${tab.path}`;
            const isActive = location.pathname === to || (tab.path === "" && location.pathname === basePath);
            return (
              <Link
                key={tab.path}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-t-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </nav>
        {children(ctx)}
      </LibraryLayout>
    </Layout>
  );
}
