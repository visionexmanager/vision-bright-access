import { useLanguage } from "@/contexts/LanguageContext";
import type { WorldFactField } from "@/features/visionkids/data/explorerWorlds";

function formatValue(value: unknown, suffix?: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.length ? value.join(", ") : null;
  return `${value}${suffix ?? ""}`;
}

export function WorldFactGrid({ content, fields }: { content: Record<string, unknown>; fields: WorldFactField[] }) {
  const { t } = useLanguage();
  const rows = fields
    .map((f) => ({ ...f, value: formatValue(content[f.key], f.suffix) }))
    .filter((f) => f.value !== null);

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 rounded-2xl border-2 border-border bg-card p-4 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.key}>
          <p className="text-xs text-muted-foreground">{t(row.labelKey)}</p>
          <p className="font-heading text-sm font-bold">{row.value}</p>
        </div>
      ))}
    </div>
  );
}
