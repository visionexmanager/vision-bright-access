import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/contexts/LanguageContext";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const driverIcon = new L.DivIcon({
  html: `<div style="background:#14b8a6;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-2-2.5-3.5C12.3 5 11 4 9 4H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const pickupIcon = new L.DivIcon({
  html: `<div style="background:#14b8a6;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const destIcon = new L.DivIcon({
  html: `<div style="background:#ef4444;border-radius:50%;width:16px;height:16px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Simulated positions (Beirut area)
const PICKUP: [number, number] = [33.856, 35.495];
const DESTINATION: [number, number] = [33.895, 35.505];
const DRIVER_START: [number, number] = [33.845, 35.485];

function AnimatedDriver({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [pos, setPos] = useState<[number, number]>(from);
  const map = useMap();

  useEffect(() => {
    let step = 0;
    const totalSteps = 60;
    const interval = setInterval(() => {
      step++;
      if (step > totalSteps) { clearInterval(interval); return; }
      const lat = from[0] + (to[0] - from[0]) * (step / totalSteps);
      const lng = from[1] + (to[1] - from[1]) * (step / totalSteps);
      setPos([lat, lng]);
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }, 1000);
    return () => clearInterval(interval);
  }, [from, to, map]);

  return <Marker position={pos} icon={driverIcon} />;
}

interface DeliveryMapProps {
  isTracking: boolean;
}

export default function DeliveryMap({ isTracking }: DeliveryMapProps) {
  const { t } = useLanguage();
  const center: [number, number] = [33.87, 35.5];

  const route: [number, number][] = [
    DRIVER_START,
    [33.85, 35.49],
    [33.86, 35.495],
    PICKUP,
    [33.87, 35.5],
    [33.88, 35.502],
    DESTINATION,
  ];

  return (
    <div className="w-full h-80 rounded-[30px] overflow-hidden border-4 border-card shadow-2xl relative z-0">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pickup marker */}
        <Marker position={PICKUP} icon={pickupIcon}>
          <Popup>{t("delivery.from")}</Popup>
        </Marker>

        {/* Destination marker */}
        <Marker position={DESTINATION} icon={destIcon}>
          <Popup>{t("delivery.to")}</Popup>
        </Marker>

        {/* Route line */}
        <Polyline
          positions={route}
          pathOptions={{ color: "#14b8a6", weight: 4, dashArray: "8 8" }}
        />

        {/* Animated driver */}
        {isTracking && <AnimatedDriver from={DRIVER_START} to={PICKUP} />}
      </MapContainer>

      {/* Live badge */}
      {isTracking && (
        <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-md px-4 py-2 rounded-full font-black text-xs shadow-lg flex items-center gap-2 text-foreground border border-border">
          <div className="w-2 h-2 bg-destructive rounded-full animate-ping" />
          {t("delivery.liveTracking")}
        </div>
      )}
    </div>
  );
}
