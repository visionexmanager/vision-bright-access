import type { ReactNode } from "react";

interface FilterChipProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}

export function FilterChip({ id, label, checked, onChange, icon }: FilterChipProps) {
  return (
    <div>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className="flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      >
        {icon}
        {label}
      </label>
    </div>
  );
}
