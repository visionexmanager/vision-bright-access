import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Globe, BadgeCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { IntelSection } from "./IntelSection";
import { COUNTRY_JOB_DATA } from "./mock/mockCountries";
import type { CountryJobData } from "./types";

function intensityColor(intensity: number): string {
  if (intensity >= 80) return "#22d3ee";
  if (intensity >= 60) return "#818cf8";
  return "#64748b";
}

export function WorldJobMap() {
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const [selectedId, setSelectedId] = useState<string>(COUNTRY_JOB_DATA[0].id);

  const selected: CountryJobData = COUNTRY_JOB_DATA.find((c) => c.id === selectedId) ?? COUNTRY_JOB_DATA[0];

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      scrollWheelZoom: false,
      worldCopyJump: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 8,
    }).addTo(map);

    COUNTRY_JOB_DATA.forEach((country) => {
      const marker = L.circleMarker([country.lat, country.lng], {
        radius: 6 + country.hiringIntensity / 12,
        color: intensityColor(country.hiringIntensity),
        fillColor: intensityColor(country.hiringIntensity),
        fillOpacity: 0.55,
        weight: 2,
      })
        .addTo(map)
        .bindPopup(`<strong>${country.name}</strong><br/>${country.openJobs.toLocaleString()} open jobs<br/>${country.remoteRatio}% remote`)
        .on("click", () => setSelectedId(country.id));
      markersRef.current.set(country.id, marker);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  return (
    <IntelSection id="map" title={t("intel.map.title")} subtitle={t("intel.map.subtitle")}>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="intel-panel overflow-hidden rounded-2xl">
          <div ref={mapRef} className="h-80 w-full sm:h-96" role="img" aria-label={t("intel.map.ariaLabel")} />
        </div>

        <div className="intel-panel flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-bold">{selected.name}</p>
            {selected.visaFriendly && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {t("intel.map.visaFriendly")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="intel-muted text-xs">{t("intel.map.openJobs")}</p><p className="font-bold">{selected.openJobs.toLocaleString()}</p></div>
            <div><p className="intel-muted text-xs">{t("intel.map.remoteRatio")}</p><p className="font-bold">{selected.remoteRatio}%</p></div>
            <div><p className="intel-muted text-xs">{t("intel.map.hiringIntensity")}</p><p className="font-bold">{selected.hiringIntensity}/100</p></div>
            <div><p className="intel-muted text-xs">{t("intel.map.avgSalary")}</p><p className="font-bold">${selected.avgSalaryUsd.toLocaleString()}</p></div>
          </div>
          <div>
            <p className="intel-muted mb-1.5 text-xs">{t("intel.map.topSkills")}</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.topSkills.map((s) => <span key={s} className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">{s}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="intel-muted mb-2 flex items-center gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" aria-hidden="true" />{t("intel.map.tableCaption")}</p>
        <div className="intel-panel overflow-hidden rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("intel.map.country")}</TableHead>
                <TableHead>{t("intel.map.openJobs")}</TableHead>
                <TableHead>{t("intel.map.remoteRatio")}</TableHead>
                <TableHead>{t("intel.map.hiringIntensity")}</TableHead>
                <TableHead>{t("intel.map.visaFriendly")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COUNTRY_JOB_DATA.map((c) => (
                <TableRow key={c.id} aria-current={c.id === selectedId ? "true" : undefined}>
                  <TableCell>
                    <button type="button" onClick={() => setSelectedId(c.id)} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                      {c.name}
                    </button>
                  </TableCell>
                  <TableCell>{c.openJobs.toLocaleString()}</TableCell>
                  <TableCell>{c.remoteRatio}%</TableCell>
                  <TableCell>{c.hiringIntensity}</TableCell>
                  <TableCell>{c.visaFriendly ? t("intel.map.yes") : t("intel.map.no")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </IntelSection>
  );
}
