import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/contexts/LanguageContext";

type SelectionStep = "pickup" | "destination";

interface LocationPickerMapProps {
  pickupCoords: [number, number] | null;
  destinationCoords: [number, number] | null;
  selectionStep: SelectionStep;
  onPickupSet: (coords: [number, number], label: string) => void;
  onDestinationSet: (coords: [number, number], label: string) => void;
}

const pickupIconHtml = `<div style="background:#14b8a6;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;
const destIconHtml = `<div style="background:#ef4444;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`;

export default function LocationPickerMap({
  pickupCoords,
  destinationCoords,
  selectionStep,
  onPickupSet,
  onDestinationSet,
}: LocationPickerMapProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const selectionStepRef = useRef(selectionStep);

  selectionStepRef.current = selectionStep;

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=en`
      );
      const data = await res.json();
      const addr = data.address;
      return addr?.road
        ? `${addr.road}${addr.suburb ? ", " + addr.suburb : ""}`
        : data.display_name?.split(",").slice(0, 2).join(",") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [33.87, 35.5],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const label = await reverseGeocode(lat, lng);

      if (selectionStepRef.current === "pickup") {
        if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
        const icon = L.divIcon({ html: pickupIconHtml, className: "", iconSize: [20, 20], iconAnchor: [10, 10] });
        pickupMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label).openPopup();
        onPickupSet([lat, lng], label);
      } else {
        if (destMarkerRef.current) map.removeLayer(destMarkerRef.current);
        const icon = L.divIcon({ html: destIconHtml, className: "", iconSize: [20, 20], iconAnchor: [10, 10] });
        destMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label).openPopup();
        onDestinationSet([lat, lng], label);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw line between pickup and destination
  useEffect(() => {
    if (!mapRef.current) return;
    if (lineRef.current) {
      mapRef.current.removeLayer(lineRef.current);
      lineRef.current = null;
    }
    if (pickupCoords && destinationCoords) {
      lineRef.current = L.polyline([pickupCoords, destinationCoords], {
        color: "#14b8a6",
        weight: 4,
        dashArray: "8 8",
      }).addTo(mapRef.current);
      mapRef.current.fitBounds([pickupCoords, destinationCoords], { padding: [40, 40] });
    }
  }, [pickupCoords, destinationCoords]);

  const [locating, setLocating] = useState(false);

  const handleLocateMe = useCallback(async () => {
    if (!("geolocation" in navigator) || !mapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current!;
        map.setView([lat, lng], 15, { animate: true });

        const label = await reverseGeocode(lat, lng);

        if (pickupMarkerRef.current) map.removeLayer(pickupMarkerRef.current);
        const icon = L.divIcon({ html: pickupIconHtml, className: "", iconSize: [20, 20], iconAnchor: [10, 10] });
        pickupMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label).openPopup();
        onPickupSet([lat, lng], label);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [onPickupSet, reverseGeocode]);

  return (
    <div className="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden border-2 border-border shadow-lg">
      <div ref={containerRef} className="w-full h-full z-0" />
      {/* Instruction badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur-md px-4 py-2 rounded-full font-bold text-xs shadow-lg flex items-center gap-2 text-foreground border border-border">
        <div
          className={`w-3 h-3 rounded-full ${
            selectionStep === "pickup" ? "bg-primary" : "bg-destructive"
          }`}
        />
        {selectionStep === "pickup"
          ? t("delivery.clickPickup")
          : t("delivery.clickDestination")}
      </div>
      {/* GPS locate button */}
      <button
        onClick={handleLocateMe}
        disabled={locating}
        className="absolute bottom-3 right-3 z-[1000] bg-card/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-border text-primary hover:bg-primary hover:text-primary-foreground transition-all disabled:opacity-50"
        title={t("delivery.locateMe")}
      >
        {locating ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        )}
      </button>
    </div>
  );
}
