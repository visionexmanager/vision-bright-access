import { useLanguage } from "@/contexts/LanguageContext";

interface GeoDeviceBreakdownProps {
  countries: Array<{ value: string; count: number }>;
  devices: Array<{ value: string; count: number }>;
  trafficSources: Array<{ value: string; count: number }>;
}

function BreakdownList({ title, items }: { title: string; items: Array<{ value: string; count: number }> }) {
  const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((item) => (
            <li key={item.value} className="space-y-0.5">
              <div className="flex justify-between text-sm"><span>{item.value}</span><span className="text-muted-foreground">{Math.round((item.count / total) * 100)}%</span></div>
              <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(item.count / total) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GeoDeviceBreakdown({ countries, devices, trafficSources }: GeoDeviceBreakdownProps) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3">
      <BreakdownList title={t("library.studio.analytics.countries")} items={countries} />
      <BreakdownList title={t("library.studio.analytics.devices")} items={devices} />
      <BreakdownList title={t("library.studio.analytics.trafficSources")} items={trafficSources} />
    </div>
  );
}
