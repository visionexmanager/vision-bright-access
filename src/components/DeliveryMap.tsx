import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/contexts/LanguageContext";

// Simulated positions (Beirut area)
const PICKUP: [number, number] = [33.856, 35.495];
const DESTINATION: [number, number] = [33.895, 35.505];
const DRIVER_START: [number, number] = [33.845, 35.485];

const ROUTE: [number, number][] = [
  DRIVER_START,
  [33.85, 35.49],
  [33.856, 35.495],
  PICKUP,
  [33.87, 35.5],
  [33.88, 35.502],
  DESTINATION,
];

interface DeliveryMapProps {
  isTracking: boolean;
}

export default function DeliveryMap({ isTracking }: DeliveryMapProps) {
  const { t } = useLanguage();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [33.87, 35.5],
      zoom: 13,
      scrollWheelZoom: false,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Pickup marker
    const pickupIcon = L.divIcon({
      html: `<div style="background:#14b8a6;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker(PICKUP, { icon: pickupIcon }).addTo(map).bindPopup(t("delivery.from"));

    // Destination marker
    const destIcon = L.divIcon({
      html: `<div style="background:#ef4444;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
      className: "",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    L.marker(DESTINATION, { icon: destIcon }).addTo(map).bindPopup(t("delivery.to"));

    // Route line
    L.polyline(ROUTE, { color: "#14b8a6", weight: 4, dashArray: "8 8" }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [t]);

  // Animated driver
  useEffect(() => {
    if (!isTracking || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const driverIcon = L.divIcon({
      html: `<div style="background:#14b8a6;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.5-3.5C12.3 5 11 4 9 4H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
      </div>`,
      className: "",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker(DRIVER_START, { icon: driverIcon }).addTo(map);
    driverMarkerRef.current = marker;

    let step = 0;
    const totalSteps = 60;
    const interval = setInterval(() => {
      step++;
      if (step > totalSteps) { clearInterval(interval); return; }
      const lat = DRIVER_START[0] + (PICKUP[0] - DRIVER_START[0]) * (step / totalSteps);
      const lng = DRIVER_START[1] + (PICKUP[1] - DRIVER_START[1]) * (step / totalSteps);
      marker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }, 1000);

    return () => {
      clearInterval(interval);
      marker.remove();
    };
  }, [isTracking]);

  return (
    <div className="relative w-full h-80 rounded-[30px] overflow-hidden border-4 border-card shadow-2xl">
      <div ref={mapRef} className="w-full h-full z-0" />
      {isTracking && (
        <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-md px-4 py-2 rounded-full font-black text-xs shadow-lg flex items-center gap-2 text-foreground border border-border">
          <div className="w-2 h-2 bg-destructive rounded-full animate-ping" />
          {t("delivery.liveTracking")}
        </div>
      )}
    </div>
  );
}
