import { Breadcrumb, type BreadcrumbItem } from "@/components/library/Breadcrumb";

interface LibraryBreadcrumbProps {
  items: BreadcrumbItem[];
}

/** Thin wrapper over the generic Breadcrumb, scoped to the Library section root. */
export function LibraryBreadcrumb({ items }: LibraryBreadcrumbProps) {
  return <Breadcrumb items={items} />;
}
