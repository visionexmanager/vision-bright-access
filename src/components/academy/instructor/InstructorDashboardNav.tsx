import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS, type InstructorDashboardSection } from "./instructorDashboardSections";

interface InstructorDashboardNavProps {
  active: InstructorDashboardSection;
}

export function InstructorDashboardNav({ active }: InstructorDashboardNavProps) {
  return (
    <nav aria-label="أقسام لوحة المدرّس" className="bg-card rounded-3xl border border-border p-2">
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <Link
                to={`/academy/instructor/dashboard?section=${item.id}`}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-muted/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.comingSoon && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">قريباً</Badge>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

