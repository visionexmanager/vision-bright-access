import type { LucideIcon } from "lucide-react";

interface StatWidgetProps {
  icon: LucideIcon;
  label: string;
  value: number;
  onClick?: () => void;
}

export function StatWidget({ icon: Icon, label, value, onClick }: StatWidgetProps) {
  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-start gap-1.5 rounded-2xl border border-border/60 bg-card p-4 text-start transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 rounded-2xl border border-border/60 bg-card p-4">
      {content}
    </div>
  );
}
