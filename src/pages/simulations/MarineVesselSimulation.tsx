import React, { useState, useEffect, useCallback, useRef, useId } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { useAIChat } from "@/hooks/useAIChat";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Ship, Anchor, MapPin, AlertTriangle, Clock, Coins,
  ChevronRight, Search, Wind, Droplets, Navigation, Gauge,
  Package, Globe, Zap, CheckCircle2, MessageSquare, Eye,
  RotateCcw, Trophy, Info, AlertCircle, Radar, Fuel, ThumbsUp,
  ThumbsDown, Send, ChevronDown, ChevronUp, Volume2, VolumeX,
} from "lucide-react";
import { SimulationScene } from "@/components/SimulationScene";
import { cn } from "@/lib/utils";

interface Props {
  simulationId?: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SimPhase  = "gate" | "active" | "complete";
type ActiveTab = "fleet" | "vessel" | "logistics" | "ai" | "accessible";
type AlertLevel = "info" | "warning" | "critical";

interface Port {
  id:      string;
  name:    string;
  country: string;
  flag:    string;
  lat:     number;
  lng:     number;
}

interface WeatherCondition {
  condition:   string;
  windKnots:   number;
  waveMeters:  number;
  visibility:  "Excellent" | "Good" | "Moderate" | "Poor";
}

interface Vessel {
  id:              string;
  name:            string;
  imo:             string;
  mmsi:            string;
  flag:            string;
  flagEmoji:       string;
  type:            string;
  owner:           string;
  operator:        string;
  yearBuilt:       number;
  lengthM:         number;
  beamM:           number;
  draftM:          number;
  grossTonnage:    number;
  cargoCapacity:   string;
  lat:             number;
  lng:             number;
  speedKnots:      number;
  heading:         number;
  status:          "Underway" | "At Anchor" | "Moored" | "In Port";
  departurePort:   Port;
  destinationPort: Port;
  etaDays:         number;
  voyageProgress:  number;
  cargoType:       string;
  cargoDetails:    string;
  weather:         WeatherCondition;
}

interface ScenarioOption {
  id:        string;
  label:     string;
  detail:    string;
  outcome:   string;
  vxReward:  number;
  delayHrs:  number;
  costUSD:   number;
  isOptimal: boolean;
}

interface LogisticsScenario {
  id:       string;
  title:    string;
  desc:     string;
  vesselId: string;
  urgency:  "low" | "medium" | "high" | "critical";
  options:  ScenarioOption[];
}

interface FleetAlert {
  id:        string;
  level:     AlertLevel;
  vesselId:  string;
  message:   string;
}

// ── Static data ───────────────────────────────────────────────────────────────

const PORTS: Port[] = [
  { id: "SHA", name: "Shanghai",    country: "China",        flag: "🇨🇳", lat:  31.22, lng: 121.46 },
  { id: "SGP", name: "Singapore",   country: "Singapore",    flag: "🇸🇬", lat:   1.26, lng: 103.82 },
  { id: "RTM", name: "Rotterdam",   country: "Netherlands",  flag: "🇳🇱", lat:  51.91, lng:   4.48 },
  { id: "HMB", name: "Hamburg",     country: "Germany",      flag: "🇩🇪", lat:  53.55, lng:   9.99 },
  { id: "JEA", name: "Jebel Ali",   country: "UAE",          flag: "🇦🇪", lat:  25.01, lng:  55.06 },
  { id: "BSN", name: "Busan",       country: "South Korea",  flag: "🇰🇷", lat:  35.18, lng: 129.08 },
  { id: "LAX", name: "Los Angeles", country: "USA",          flag: "🇺🇸", lat:  33.74, lng:-118.27 },
  { id: "NYC", name: "New York",    country: "USA",          flag: "🇺🇸", lat:  40.70, lng: -74.01 },
  { id: "MBY", name: "Mumbai",      country: "India",        flag: "🇮🇳", lat:  18.93, lng:  72.84 },
  { id: "CSL", name: "Colombo",     country: "Sri Lanka",    flag: "🇱🇰", lat:   6.93, lng:  79.85 },
  { id: "ALX", name: "Alexandria",  country: "Egypt",        flag: "🇪🇬", lat:  31.18, lng:  29.89 },
  { id: "RTN", name: "Ras Tanura",  country: "Saudi Arabia", flag: "🇸🇦", lat:  26.69, lng:  50.16 },
  { id: "YOK", name: "Yokohama",    country: "Japan",        flag: "🇯🇵", lat:  35.45, lng: 139.65 },
  { id: "BRE", name: "Bremerhaven", country: "Germany",      flag: "🇩🇪", lat:  53.55, lng:   8.58 },
  { id: "ANR", name: "Antwerp",     country: "Belgium",      flag: "🇧🇪", lat:  51.23, lng:   4.41 },
];

const p = (id: string): Port => PORTS.find(x => x.id === id)!;

const INITIAL_VESSELS: Vessel[] = [
  {
    id: "V001", name: "MV Nile Pioneer",    imo: "9812341", mmsi: "636093451",
    flag: "Panama", flagEmoji: "🇵🇦", type: "Container Ship",
    owner: "Global Container Lines", operator: "Mediterranean Cargo Corp",
    yearBuilt: 2019, lengthM: 366, beamM: 51, draftM: 14.5,
    grossTonnage: 153000, cargoCapacity: "14 000 TEU",
    lat: 30.5, lng: 19.8, speedKnots: 18.5, heading: 280,
    status: "Underway", departurePort: p("ALX"), destinationPort: p("RTM"),
    etaDays: 4, voyageProgress: 42,
    cargoType: "General Container", cargoDetails: "Mixed consumer goods, electronics, textiles",
    weather: { condition: "Fair", windKnots: 12, waveMeters: 1.2, visibility: "Good" },
  },
  {
    id: "V002", name: "MT Gulf Meridian",   imo: "9734512", mmsi: "538007231",
    flag: "Marshall Islands", flagEmoji: "🇲🇭", type: "Oil Tanker",
    owner: "PetroShip Holdings", operator: "Arabian Gulf Tankers",
    yearBuilt: 2017, lengthM: 332, beamM: 60, draftM: 21.0,
    grossTonnage: 162000, cargoCapacity: "320 000 DWT",
    lat: 20.4, lng: 64.9, speedKnots: 14.0, heading: 290,
    status: "Underway", departurePort: p("RTN"), destinationPort: p("RTM"),
    etaDays: 12, voyageProgress: 28,
    cargoType: "Crude Oil", cargoDetails: "Arabian Light Crude, 310 000 MT",
    weather: { condition: "Partly Cloudy", windKnots: 18, waveMeters: 2.1, visibility: "Good" },
  },
  {
    id: "V003", name: "MV Pacific Crown",   imo: "9655879", mmsi: "477283641",
    flag: "Hong Kong", flagEmoji: "🇭🇰", type: "Bulk Carrier",
    owner: "Pacific Bulk Ltd", operator: "Crown Maritime Services",
    yearBuilt: 2016, lengthM: 295, beamM: 45, draftM: 18.2,
    grossTonnage: 92000, cargoCapacity: "180 000 DWT",
    lat: 42.1, lng: 170.3, speedKnots: 12.5, heading: 95,
    status: "Underway", departurePort: p("YOK"), destinationPort: p("LAX"),
    etaDays: 7, voyageProgress: 55,
    cargoType: "Iron Ore", cargoDetails: "Iron ore pellets, 172 000 MT",
    weather: { condition: "Stormy", windKnots: 38, waveMeters: 5.8, visibility: "Moderate" },
  },
  {
    id: "V004", name: "MV Atlantic Horizon", imo: "9789023", mmsi: "311040021",
    flag: "Bahamas", flagEmoji: "🇧🇸", type: "Container Ship",
    owner: "TransAtlantic Shipping Co", operator: "Atlantic Container Lines",
    yearBuilt: 2020, lengthM: 400, beamM: 59, draftM: 16.0,
    grossTonnage: 235000, cargoCapacity: "23 600 TEU",
    lat: 46.2, lng: -31.5, speedKnots: 22.0, heading: 80,
    status: "Underway", departurePort: p("NYC"), destinationPort: p("HMB"),
    etaDays: 3, voyageProgress: 67,
    cargoType: "General Container", cargoDetails: "Automotive parts, pharmaceuticals, perishables",
    weather: { condition: "Overcast", windKnots: 22, waveMeters: 3.4, visibility: "Good" },
  },
  {
    id: "V005", name: "MV Bosphorus Star",  imo: "9600341", mmsi: "271042318",
    flag: "Türkiye", flagEmoji: "🇹🇷", type: "General Cargo",
    owner: "Bosphorus Maritime", operator: "Star Lines Shipping",
    yearBuilt: 2014, lengthM: 189, beamM: 28, draftM: 9.4,
    grossTonnage: 18500, cargoCapacity: "22 000 DWT",
    lat: 22.1, lng: 37.9, speedKnots: 10.0, heading: 165,
    status: "Underway", departurePort: p("ANR"), destinationPort: p("JEA"),
    etaDays: 6, voyageProgress: 71,
    cargoType: "Project Cargo", cargoDetails: "Heavy machinery, steel structures, industrial equipment",
    weather: { condition: "Clear", windKnots: 8, waveMeters: 0.6, visibility: "Excellent" },
  },
  {
    id: "V006", name: "MV Singapore Express", imo: "9841205", mmsi: "564371902",
    flag: "Singapore", flagEmoji: "🇸🇬", type: "Container Ship",
    owner: "Pacific Gateway Shipping", operator: "Express Maritime Corp",
    yearBuilt: 2021, lengthM: 350, beamM: 54, draftM: 15.5,
    grossTonnage: 140000, cargoCapacity: "12 000 TEU",
    lat: 15.3, lng: 110.1, speedKnots: 20.0, heading: 350,
    status: "Underway", departurePort: p("SGP"), destinationPort: p("BSN"),
    etaDays: 3, voyageProgress: 38,
    cargoType: "General Container", cargoDetails: "Electronics, clothing, processed food",
    weather: { condition: "Clear", windKnots: 10, waveMeters: 0.8, visibility: "Excellent" },
  },
  {
    id: "V007", name: "MT Emerald Gulf",    imo: "9703156", mmsi: "457391045",
    flag: "Qatar", flagEmoji: "🇶🇦", type: "LNG Carrier",
    owner: "Qatar LNG Fleet", operator: "Emerald Energy Shipping",
    yearBuilt: 2018, lengthM: 295, beamM: 46, draftM: 12.0,
    grossTonnage: 95000, cargoCapacity: "155 000 m³ LNG",
    lat: 10.2, lng: 75.6, speedKnots: 16.5, heading: 75,
    status: "Underway", departurePort: p("RTN"), destinationPort: p("YOK"),
    etaDays: 9, voyageProgress: 44,
    cargoType: "Liquefied Natural Gas", cargoDetails: "LNG, 140 000 m³, Qatar Origin",
    weather: { condition: "Fair", windKnots: 14, waveMeters: 1.4, visibility: "Good" },
  },
  {
    id: "V008", name: "MV Nordic Harmony",  imo: "9588742", mmsi: "257813604",
    flag: "Norway", flagEmoji: "🇳🇴", type: "RoRo Vessel",
    owner: "Nordic Maritime Group", operator: "Harmony Shipping AS",
    yearBuilt: 2015, lengthM: 226, beamM: 32, draftM: 8.5,
    grossTonnage: 57000, cargoCapacity: "6 500 CEU",
    lat:  2.1, lng: -15.4, speedKnots: 18.0, heading: 195,
    status: "Underway", departurePort: p("BRE"), destinationPort: p("MBY"),
    etaDays: 16, voyageProgress: 19,
    cargoType: "Roll-on/Roll-off", cargoDetails: "Vehicles: 4 200 passenger cars, 180 heavy trucks",
    weather: { condition: "Partly Cloudy", windKnots: 20, waveMeters: 2.8, visibility: "Good" },
  },
];

const SCENARIOS: LogisticsScenario[] = [
  {
    id: "S1", vesselId: "V001",
    urgency: "high",
    title: "Port Congestion — Alexandria",
    desc: "MV Nile Pioneer is 12 hours from Alexandria but the port is reporting a 72-hour berth wait due to simultaneous arrival of 14 vessels. Cargo owner is demanding on-time delivery.",
    options: [
      {
        id: "A", label: "Wait at Anchor",
        detail: "Anchor 8 nm offshore, wait for berth assignment. No extra cost, but adds 72 hrs to schedule.",
        outcome: "Vessel waits safely. Cargo delayed 3 days. Customer satisfaction drops. Steady decision.", vxReward: 150, delayHrs: 72, costUSD: 0, isOptimal: false,
      },
      {
        id: "B", label: "Divert to Damietta Port",
        detail: "Divert 180 km to Damietta — berth available in 4 hrs. Adds trucking cost of $28 000 to final destination.",
        outcome: "Cargo delivered with only 8 hrs delay. Excellent port utilization. Cost justified by schedule recovery.", vxReward: 450, delayHrs: 8, costUSD: 28000, isOptimal: true,
      },
      {
        id: "C", label: "Pay Priority Berth Fee",
        detail: "Pay $45 000 to jump the queue and berth in 6 hrs. Expensive but keeps the original plan.",
        outcome: "Berths in 6 hrs. Cargo on schedule. High cost erodes voyage margin significantly.", vxReward: 250, delayHrs: 6, costUSD: 45000, isOptimal: false,
      },
    ],
  },
  {
    id: "S2", vesselId: "V003",
    urgency: "critical",
    title: "Tropical Cyclone — North Pacific",
    desc: "MV Pacific Crown is crossing the North Pacific. Typhoon Miriam (Category 3) is forecast to intersect the vessel's track in 18 hours. Wind speeds expected 95 knots, 8m swells.",
    options: [
      {
        id: "A", label: "Maintain Course at Reduced Speed",
        detail: "Reduce to 8 knots and brace for impact. Risky — 8m swells may endanger cargo and crew.",
        outcome: "Vessel sustains moderate cargo damage. Crew safe but three containers lost overboard. Major insurance claim required.", vxReward: 50, delayHrs: 36, costUSD: 180000, isOptimal: false,
      },
      {
        id: "B", label: "Northern Deviation Route",
        detail: "Alter course 28° north to skirt the storm edge. Adds 850 nm and approximately 48 hrs.",
        outcome: "Vessel clears storm with only light swells. Cargo intact. Schedule impact manageable. Sound seamanship.", vxReward: 500, delayHrs: 48, costUSD: 22000, isOptimal: true,
      },
      {
        id: "C", label: "Shelter at Yokohama",
        detail: "Return to Yokohama and wait 5 days for storm to pass. Safest for vessel but major schedule impact.",
        outcome: "Vessel and cargo safe. 120-hour delay triggers penalty clauses in charter party. Costly but defensible.", vxReward: 200, delayHrs: 120, costUSD: 48000, isOptimal: false,
      },
    ],
  },
  {
    id: "S3", vesselId: "V002",
    urgency: "high",
    title: "Customs Documentation Failure — Rotterdam",
    desc: "MT Gulf Meridian is 8 hours from Rotterdam. Port authority flags missing cargo manifest certificates for 3 of 12 parcel shipments co-loaded with crude. Vessel may be held at anchorage.",
    options: [
      {
        id: "A", label: "Submit Emergency Amended Manifest",
        detail: "Work with port agent to issue corrected manifest digitally. Port authority review takes 4-6 hrs.",
        outcome: "Documents accepted after 5-hr review. Vessel berths only 5 hrs late. Efficient resolution.", vxReward: 400, delayHrs: 5, costUSD: 3500, isOptimal: true,
      },
      {
        id: "B", label: "Hire Customs Clearance Broker",
        detail: "Engage specialist broker at $12 000 fee to expedite clearance. Typically resolves in 2-3 hrs.",
        outcome: "Broker clears in 3 hrs. Small additional cost but very fast. Slight overspend vs. best option.", vxReward: 300, delayHrs: 3, costUSD: 12000, isOptimal: false,
      },
      {
        id: "C", label: "Wait at Anchorage for Shore Staff",
        detail: "Anchor and wait for the shipper to courier original paper documents. Estimated 36-hour wait.",
        outcome: "36-hour detention. Demurrage charges accumulate. Unnecessary delay given digital options available.", vxReward: 80, delayHrs: 36, costUSD: 0, isOptimal: false,
      },
    ],
  },
  {
    id: "S4", vesselId: "V007",
    urgency: "critical",
    title: "Engine Fault — Arabian Sea",
    desc: "MT Emerald Gulf reports Main Engine RPM has dropped 40%. Chief Engineer suspects a damaged turbocharger bearing. Vessel can make 8 knots on reduced power. Cargo is LNG under time-critical delivery.",
    options: [
      {
        id: "A", label: "Continue at 8 Knots",
        detail: "Proceed at reduced power. Risk of complete engine failure in open ocean. ETA extended 5 days.",
        outcome: "Engine holds but vessel arrives 5 days late. LNG cargo demurrage penalty: $420 000. Gamble that barely paid off.", vxReward: 100, delayHrs: 120, costUSD: 420000, isOptimal: false,
      },
      {
        id: "B", label: "Divert to Colombo for Emergency Repair",
        detail: "Colombo is 340 nm away. Turbocharger part available in 24 hrs. Repair takes 18 hrs after parts arrival.",
        outcome: "Engine repaired fully. 52-hr delay with $95 000 repair + port costs. Vessel continues safely at full speed.", vxReward: 480, delayHrs: 52, costUSD: 95000, isOptimal: true,
      },
      {
        id: "C", label: "Request Ocean Tug Assistance",
        detail: "Contract a salvage tug from Mumbai — 18 hrs arrival, tow to port costs $280 000.",
        outcome: "Vessel safely towed but cost far exceeds divert-and-repair option. Overkill for this fault level.", vxReward: 150, delayHrs: 96, costUSD: 280000, isOptimal: false,
      },
    ],
  },
  {
    id: "S5", vesselId: "V005",
    urgency: "high",
    title: "Piracy Alert — Gulf of Aden",
    desc: "MV Bosphorus Star is transiting the Gulf of Aden. Maritime security agencies issue a Level 3 piracy alert for the vessel's planned route. Three incidents reported in the area in the past 72 hours.",
    options: [
      {
        id: "A", label: "Join IRTC Convoy with Naval Escort",
        detail: "Register with the International Recommended Transit Corridor. Next convoy departs in 14 hrs, adds 8 hrs transit time.",
        outcome: "Vessel transits safely under naval protection. Delay manageable. Industry best practice for this threat level.", vxReward: 480, delayHrs: 22, costUSD: 4000, isOptimal: true,
      },
      {
        id: "B", label: "Contract Private Armed Security",
        detail: "Embark 4-person armed guard team at Djibouti. Cost $18 000. Proceed on schedule.",
        outcome: "Vessel transits on schedule with armed guards. No incidents. Marginally riskier than convoy but acceptable.", vxReward: 320, delayHrs: 0, costUSD: 18000, isOptimal: false,
      },
      {
        id: "C", label: "Cape of Good Hope Detour",
        detail: "Reroute around southern Africa. Adds 4 200 nm and 14 days to voyage. High fuel cost.",
        outcome: "Vessel arrives safe but 14-day delay. Cargo owner imposes penalty clause. Massive fuel overconsumption.", vxReward: 80, delayHrs: 336, costUSD: 140000, isOptimal: false,
      },
    ],
  },
  {
    id: "S6", vesselId: "V004",
    urgency: "medium",
    title: "Suez Canal Traffic Delay",
    desc: "MV Atlantic Horizon is approaching Port Said for Suez Canal transit. A grounded vessel is blocking the southern entrance. Estimated clearance time: 18-24 hours. 31 vessels are queued.",
    options: [
      {
        id: "A", label: "Wait for Canal Clearance",
        detail: "Anchor at Port Said and wait. Fuel consumption minimal at anchor. Expected 20-hr wait.",
        outcome: "Canal clears after 19 hrs. Vessel transits normally. Minor delay, lowest cost option for this situation.", vxReward: 380, delayHrs: 19, costUSD: 8000, isOptimal: true,
      },
      {
        id: "B", label: "Request Priority Convoy Slot",
        detail: "Pay SCA $65 000 priority fee for next available slot. Estimated 8-hr wait.",
        outcome: "Vessel transits 8 hrs after payment. Cost high relative to delay saved vs. waiting.", vxReward: 200, delayHrs: 8, costUSD: 65000, isOptimal: false,
      },
      {
        id: "C", label: "Divert via Cape of Good Hope",
        detail: "Turn around and route south around Africa. 9 000 nm longer. 22 additional days.",
        outcome: "22-day delay triggers major charter party penalties. Extreme overreaction to a temporary 20-hour blockage.", vxReward: 20, delayHrs: 528, costUSD: 380000, isOptimal: false,
      },
    ],
  },
];

const INITIAL_ALERTS: FleetAlert[] = [
  { id: "A1", level: "critical", vesselId: "V003", message: "Typhoon Miriam — Category 3 storm intersects course in 18 hrs. Immediate routing decision required." },
  { id: "A2", level: "warning",  vesselId: "V001", message: "Alexandria port congestion: 72-hour berth wait reported. Alternative routing recommended." },
  { id: "A3", level: "warning",  vesselId: "V007", message: "Main engine turbocharger fault detected. Vessel speed reduced to 8 knots. Engineer assessment in progress." },
  { id: "A4", level: "info",     vesselId: "V004", message: "Atlantic Horizon ETA confirmed Hamburg: 3 days. All systems nominal." },
  { id: "A5", level: "info",     vesselId: "V006", message: "Singapore Express cleared Singapore Strait. On schedule to Busan." },
];

// ── Map component ─────────────────────────────────────────────────────────────

interface WorldMapProps {
  vessels:         Vessel[];
  selectedVessel:  Vessel | null;
  onSelectVessel:  (v: Vessel) => void;
}

function WorldMap({ vessels, selectedVessel, onSelectVessel }: WorldMapProps) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerRefs  = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [20, 10],
      zoom:   3,
      minZoom: 2,
      maxZoom: 10,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      markerRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear old markers
    markerRefs.current.forEach(m => m.remove());
    markerRefs.current.clear();

    // Port markers
    PORTS.forEach(port => {
      const icon = L.divIcon({
        html: `<div style="width:8px;height:8px;background:#38bdf8;border-radius:50%;border:2px solid rgba(56,189,248,0.4);box-shadow:0 0 6px #38bdf8;"></div>`,
        className: "",
        iconSize: [8, 8],
        iconAnchor: [4, 4],
      });
      L.marker([port.lat, port.lng], { icon })
        .addTo(map)
        .bindTooltip(`${port.flag} ${port.name}`, { className: "leaflet-dark-tooltip" });
    });

    // Vessel markers
    vessels.forEach(vessel => {
      const isSelected = selectedVessel?.id === vessel.id;
      const alertColors: Record<string, string> = {
        "V003": "#ef4444",
        "V007": "#ef4444",
        "V001": "#f59e0b",
        "V005": "#f59e0b",
      };
      const color = alertColors[vessel.id] ?? (isSelected ? "#22d3ee" : "#34d399");
      const size  = isSelected ? 18 : 14;

      const icon = L.divIcon({
        html: `
          <div style="position:relative;width:${size}px;height:${size}px;">
            <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}" style="filter:drop-shadow(0 0 4px ${color});">
              <path d="M12 2L4 20h3l5-4 5 4h3L12 2z" transform="rotate(${vessel.heading},12,12)"/>
            </svg>
          </div>`,
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([vessel.lat, vessel.lng], { icon })
        .addTo(map)
        .bindTooltip(
          `<b>${vessel.name}</b><br/>${vessel.type}<br/>${vessel.speedKnots} kn | ${vessel.status}`,
          { className: "leaflet-dark-tooltip" }
        )
        .on("click", () => onSelectVessel(vessel));

      markerRefs.current.set(vessel.id, marker);
    });
  }, [vessels, selectedVessel, onSelectVessel]);

  // Pan to selected vessel
  useEffect(() => {
    if (selectedVessel && mapInstance.current) {
      mapInstance.current.flyTo([selectedVessel.lat, selectedVessel.lng], 5, { duration: 1.2 });
    }
  }, [selectedVessel]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-lg overflow-hidden"
      role="application"
      aria-label="World map showing vessel positions. Use keyboard to navigate list below for accessible vessel data."
      style={{ minHeight: 320 }}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: Vessel["status"]) {
  return s === "Underway"   ? "text-emerald-400" :
         s === "At Anchor"  ? "text-amber-400"   :
         s === "In Port"    ? "text-sky-400"      : "text-slate-400";
}

function alertBg(level: AlertLevel) {
  return level === "critical" ? "border-red-500/40 bg-red-950/40" :
         level === "warning"  ? "border-amber-500/40 bg-amber-950/30" :
                                "border-sky-500/30 bg-sky-950/20";
}

function alertIcon(level: AlertLevel) {
  return level === "critical" ? <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" aria-hidden="true" /> :
         level === "warning"  ? <AlertCircle   className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" /> :
                                <Info          className="h-4 w-4 text-sky-400 shrink-0"   aria-hidden="true" />;
}

function urgencyBadge(u: LogisticsScenario["urgency"]) {
  const cls =
    u === "critical" ? "border-red-500/60 bg-red-500/20 text-red-300" :
    u === "high"     ? "border-amber-500/60 bg-amber-500/20 text-amber-300" :
    u === "medium"   ? "border-yellow-500/50 bg-yellow-500/15 text-yellow-300" :
                       "border-sky-500/40 bg-sky-500/10 text-sky-300";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", cls)}>{u}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarineVesselSimulation({ simulationId }: Props) {
  const uid                     = useId();
  const { user }                = useAuth();
  const { t }                   = useLanguage();
  const { balance, spendVX }    = useVXWallet();
  const { earnPoints }          = useEarnPoints();
  const { announce, announceUrgent } = useScreenReader();
  const { savedProgress }       = useSimulationProgress(simulationId);
  const { messages, isLoading: aiLoading, sendMessage, clearMessages } = useAIChat();

  const SESSION_COST = 300;

  const [phase,              setPhase]             = useState<SimPhase>("gate");
  const [activeTab,          setActiveTab]          = useState<ActiveTab>("fleet");
  const [vessels,            setVessels]            = useState<Vessel[]>(INITIAL_VESSELS);
  const [selectedVessel,     setSelectedVessel]     = useState<Vessel | null>(null);
  const [searchQuery,        setSearchQuery]        = useState("");
  const [alerts,             setAlerts]             = useState<FleetAlert[]>(INITIAL_ALERTS);
  const [completedScenarios, setCompletedScenarios] = useState<Set<string>>(new Set());
  const [activeScenario,     setActiveScenario]     = useState<LogisticsScenario | null>(null);
  const [scenarioChoice,     setScenarioChoice]     = useState<ScenarioOption | null>(null);
  const [score,              setScore]              = useState(0);
  const [vxEarned,           setVxEarned]           = useState(0);
  const [positionTick,       setPositionTick]       = useState(0);
  const [aiInput,            setAiInput]            = useState("");
  const [expandedAlerts,     setExpandedAlerts]     = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Tab heading IDs for accessibility
  const fleetHId    = `${uid}-fleet-h`;
  const vesselHId   = `${uid}-vessel-h`;
  const logHId      = `${uid}-log-h`;
  const aiHId       = `${uid}-ai-h`;
  const accHId      = `${uid}-acc-h`;

  // Restore prior session
  useEffect(() => {
    if (savedProgress?.decisions && !savedProgress.completed) {
      try {
        const saved = savedProgress.decisions as { completedScenarios?: string[]; score?: number };
        if (saved.completedScenarios) setCompletedScenarios(new Set(saved.completedScenarios));
        if (saved.score)              setScore(saved.score);
      } catch { /* ignore malformed saves */ }
    }
  }, [savedProgress]);

  // Simulate vessel movement every 12 seconds (1 tick ≈ 10 nautical minutes)
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => {
      setPositionTick(t => t + 1);
      setVessels(prev => prev.map(v => {
        if (v.status !== "Underway") return v;
        const RAD = Math.PI / 180;
        const nm  = (v.speedKnots * 10) / 60; // nm per tick
        const dlat = nm * Math.cos(v.heading * RAD) / 60;
        const dlng = nm * Math.sin(v.heading * RAD) / (60 * Math.cos(v.lat * RAD));
        return { ...v, lat: v.lat + dlat, lng: v.lng + dlng };
      }));
    }, 12000);
    return () => clearInterval(id);
  }, [phase]);

  // Auto-scroll AI chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Gate: pay session fee
  const handleEnter = useCallback(async () => {
    if (!user) {
      toast.error("Please sign in to access the Maritime Command Center.");
      return;
    }
    const ok = await spendVX(SESSION_COST, "simulation-entry", "Marine Vessel Tracking Simulator");
    if (!ok) return;
    setPhase("active");
    announce("Maritime Command Center activated. Fleet of 8 vessels is now live on the world map.");
    toast.success("⚓ Command Center active — fleet online.");
  }, [user, spendVX, announce]);

  // Select vessel + announce to screen reader
  const handleSelectVessel = useCallback((v: Vessel) => {
    setSelectedVessel(v);
    setActiveTab("vessel");
    announce(
      `Vessel selected: ${v.name}. ${v.type}. Flag: ${v.flag}. ` +
      `Status: ${v.status}. Speed: ${v.speedKnots} knots. ` +
      `Voyage from ${v.departurePort.name} to ${v.destinationPort.name}. ` +
      `ETA: ${v.etaDays} days. Progress: ${v.voyageProgress}%.`
    );
  }, [announce]);

  // Logistics: choose scenario
  const handleOpenScenario = useCallback((s: LogisticsScenario) => {
    setActiveScenario(s);
    setScenarioChoice(null);
    setActiveTab("logistics");
    announceUrgent(`Logistics emergency: ${s.title}. Urgency: ${s.urgency}. ${s.desc}`);
  }, [announceUrgent]);

  // Logistics: decide
  const handleDecide = useCallback(async (option: ScenarioOption) => {
    if (!activeScenario || !user) return;
    setScenarioChoice(option);

    const newScore = score + option.vxReward;
    const earned   = option.vxReward;
    setScore(newScore);
    setVxEarned(vxEarned + earned);
    const newCompleted = new Set([...completedScenarios, activeScenario.id]);
    setCompletedScenarios(newCompleted);

    // Dismiss alert for this vessel
    setAlerts(prev => prev.filter(a => a.vesselId !== activeScenario.vesselId));

    // Award VX
    await earnPoints(earned, `Maritime decision: ${activeScenario.title}`);

    const status = option.isOptimal ? "Optimal decision" : "Acceptable decision";
    announce(`${status} selected: ${option.label}. Outcome: ${option.outcome}. VX earned: ${earned}.`);
    toast.success(`+${earned} VX — ${option.isOptimal ? "Optimal decision!" : "Decision recorded."}`);

    // Save progress
    if (user) {
      const allDone = newCompleted.size >= SCENARIOS.length;
      await saveSimulationProgress(user.id, simulationId ?? "", {
        current_step: newCompleted.size,
        decisions:    { completedScenarios: [...newCompleted], score: newScore },
        score:        newScore,
        completed:    allDone,
      });
      if (allDone) {
        const bonus = 1000;
        await earnPoints(bonus, "Maritime simulator completion bonus");
        setVxEarned(vxEarned + earned + bonus);
        setPhase("complete");
        announce(`Mission complete! All scenarios resolved. Final score: ${newScore}. Total VX earned: ${vxEarned + earned + bonus}.`);
      }
    }
  }, [activeScenario, score, vxEarned, completedScenarios, earnPoints, simulationId, user, announce]);

  // AI send
  const handleAISend = useCallback(() => {
    if (!aiInput.trim() || aiLoading) return;
    const fleetContext = vessels.map(v =>
      `${v.name} (${v.type}, ${v.flag}): ${v.status}, ${v.speedKnots}kn heading ${v.heading}°, en route ${v.departurePort.name}→${v.destinationPort.name}, ETA ${v.etaDays}d, ${v.voyageProgress}% complete.`
    ).join(" | ");
    sendMessage(aiInput, {
      productName: "Maritime Command Center",
      currentStep: `Fleet context: ${fleetContext}. Active alerts: ${alerts.map(a => a.message).join("; ")}`,
    });
    setAiInput("");
  }, [aiInput, aiLoading, sendMessage, vessels, alerts]);

  // Filtered vessel search
  const q = searchQuery.toLowerCase();
  const searchResults = q
    ? vessels.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.imo.includes(q) ||
        v.mmsi.includes(q) ||
        v.flag.toLowerCase().includes(q) ||
        v.type.toLowerCase().includes(q) ||
        v.destinationPort.name.toLowerCase().includes(q) ||
        v.departurePort.name.toLowerCase().includes(q) ||
        v.cargoType.toLowerCase().includes(q)
      )
    : vessels;

  const pendingScenarios = SCENARIOS.filter(s => !completedScenarios.has(s.id));
  const progressPct = (completedScenarios.size / SCENARIOS.length) * 100;

  // ── Gate phase ──────────────────────────────────────────────────────────────
  if (phase === "gate") {
    return (
      <div
        className="min-h-screen bg-[#020a14] text-slate-100 flex flex-col items-center justify-center p-4"
        role="main"
        aria-labelledby="gate-heading"
      >
        <SimulationScene slug="marine-vessel" isActive={false} />
        <div className="relative z-10 w-full max-w-lg">
          <Card className="border-cyan-500/30 bg-[#071428]/90 backdrop-blur-md shadow-2xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30">
                <Ship className="h-10 w-10 text-cyan-400" aria-hidden="true" />
              </div>
              <CardTitle id="gate-heading" className="text-2xl font-bold text-slate-100">
                Maritime Command Center
              </CardTitle>
              <p className="text-sm text-slate-400 mt-1">Live Marine Vessel Tracking & Logistics Simulator</p>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["🗺️", "Fleet of 8 live vessels"],
                  ["⚓", "Global port network"],
                  ["📦", "6 logistics scenarios"],
                  ["🤖", "AI maritime advisor"],
                ].map(([icon, label]) => (
                  <div key={label as string} className="flex items-center gap-2 rounded-lg bg-cyan-500/5 border border-cyan-500/15 px-3 py-2">
                    <span role="img" aria-hidden="true">{icon}</span>
                    <span className="text-slate-300">{label as string}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-[#0a2040] border border-cyan-500/20 px-4 py-3 text-sm">
                <p className="text-slate-400">Session fee</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <Coins className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  <span className="text-2xl font-bold text-cyan-400">300 VX</span>
                  <span className="text-slate-500 text-xs">/ session</span>
                </div>
                <p className="mt-1 text-slate-500 text-xs">Your balance: {balance.toLocaleString()} VX</p>
              </div>

              <Button
                onClick={handleEnter}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 text-base"
                disabled={!user || balance < SESSION_COST}
              >
                <Navigation className="mr-2 h-5 w-5" aria-hidden="true" />
                {!user ? "Sign in to continue" : balance < SESSION_COST ? "Insufficient VX" : "Activate Command Center"}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Earn up to 5 000 VX through optimal routing and logistics decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Complete phase ──────────────────────────────────────────────────────────
  if (phase === "complete") {
    return (
      <div
        className="min-h-screen bg-[#020a14] text-slate-100 flex items-center justify-center p-4"
        role="main"
        aria-labelledby="complete-heading"
      >
        <Card className="w-full max-w-lg border-cyan-500/30 bg-[#071428]/90 backdrop-blur-md text-center">
          <CardContent className="pt-10 pb-8 space-y-6">
            <Trophy className="mx-auto h-16 w-16 text-yellow-400" aria-hidden="true" />
            <div>
              <h2 id="complete-heading" className="text-2xl font-bold text-slate-100">Mission Complete</h2>
              <p className="text-slate-400 mt-1">All maritime emergencies resolved successfully.</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Score",        value: score.toLocaleString() },
                { label: "VX Earned",    value: `${vxEarned.toLocaleString()} VX` },
                { label: "Scenarios",    value: `${completedScenarios.size}/${SCENARIOS.length}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 py-3">
                  <p className="text-lg font-bold text-cyan-400">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <Button
              onClick={() => { setPhase("gate"); setCompletedScenarios(new Set()); setScore(0); setVxEarned(0); clearMessages(); }}
              className="w-full bg-cyan-700 hover:bg-cyan-600"
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              New Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Active phase ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#020a14] text-slate-100" role="main" aria-label="Maritime Command Center">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-cyan-900/40 bg-[#020a14]/95 backdrop-blur px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Ship className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <span className="font-bold text-sm text-slate-100 hidden sm:inline">VISIONEX NAV</span>
            <Badge className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" aria-hidden="true" />
              LIVE
            </Badge>
          </div>

          <nav className="flex gap-1" role="tablist" aria-label="Command Center sections">
            {(
              [
                { id: "fleet",      label: "Fleet",    icon: Globe         },
                { id: "vessel",     label: "Vessel",   icon: Ship          },
                { id: "logistics",  label: "Logistics", icon: Package       },
                { id: "ai",         label: "AI Bridge", icon: MessageSquare },
                { id: "accessible", label: "Text View", icon: Eye          },
              ] as { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all",
                  activeTab === id
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <Coins className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span className="font-bold text-cyan-400">{vxEarned.toLocaleString()}</span>
            <span className="hidden sm:inline text-slate-500">VX earned</span>
          </div>
        </div>
      </header>

      {/* Alerts bar */}
      {alerts.filter(a => a.level !== "info").length > 0 && (
        <div className="border-b border-amber-900/30 bg-amber-950/20 px-4">
          <div className="mx-auto max-w-7xl">
            <button
              className="flex w-full items-center justify-between py-2 text-xs text-amber-400 font-semibold"
              onClick={() => setExpandedAlerts(e => !e)}
              aria-expanded={expandedAlerts}
              aria-controls="alert-list"
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {alerts.filter(a => a.level !== "info").length} active alert(s) — click to {expandedAlerts ? "collapse" : "expand"}
              </span>
              {expandedAlerts ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
            {expandedAlerts && (
              <ul id="alert-list" className="pb-2 space-y-1" aria-label="Fleet alerts" aria-live="polite">
                {alerts.filter(a => a.level !== "info").map(alert => {
                  const relatedSim = SCENARIOS.find(s => s.vesselId === alert.vesselId);
                  return (
                    <li
                      key={alert.id}
                      className={cn("flex items-start gap-2 rounded border px-3 py-1.5 text-xs cursor-pointer hover:brightness-110 transition-all", alertBg(alert.level))}
                      onClick={() => relatedSim && handleOpenScenario(relatedSim)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === "Enter" && relatedSim && handleOpenScenario(relatedSim)}
                      aria-label={`${alert.level} alert for ${vessels.find(v => v.id === alert.vesselId)?.name ?? alert.vesselId}: ${alert.message}${relatedSim ? ". Press Enter to handle this emergency." : ""}`}
                    >
                      {alertIcon(alert.level)}
                      <span className="text-slate-300">{alert.message}</span>
                      {relatedSim && (
                        <span className="ml-auto shrink-0 text-[10px] font-bold text-cyan-400 underline underline-offset-2">Handle →</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Mission progress */}
      <div className="border-b border-cyan-900/30 px-4 py-2 bg-[#030f1e]">
        <div className="mx-auto max-w-7xl flex items-center gap-3">
          <span className="text-xs text-slate-400 shrink-0">
            Mission: {completedScenarios.size}/{SCENARIOS.length}
          </span>
          <Progress value={progressPct} className="flex-1 h-1.5 bg-slate-800" aria-label={`Mission progress: ${Math.round(progressPct)}%`} />
          <span className="text-xs font-bold text-cyan-400 shrink-0">{Math.round(progressPct)}%</span>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-4">

        {/* ── Fleet Tab ── */}
        {activeTab === "fleet" && (
          <section aria-labelledby={fleetHId}>
            <h2 id={fleetHId} className="sr-only">Fleet Overview</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* World map */}
              <div className="lg:col-span-2 rounded-xl border border-cyan-900/30 overflow-hidden" style={{ height: 420 }}>
                <WorldMap
                  vessels={vessels}
                  selectedVessel={selectedVessel}
                  onSelectVessel={handleSelectVessel}
                />
              </div>

              {/* Fleet list */}
              <div className="rounded-xl border border-cyan-900/30 bg-[#030f1e] flex flex-col overflow-hidden" style={{ maxHeight: 420 }}>
                <div className="px-3 py-2 border-b border-cyan-900/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Fleet ({vessels.length})</span>
                  <Radar className="h-3.5 w-3.5 text-cyan-500 animate-spin" style={{ animationDuration: "4s" }} aria-hidden="true" />
                </div>
                <ScrollArea className="flex-1">
                  <ul role="list" aria-label="Vessel list">
                    {vessels.map(v => {
                      const hasAlert = alerts.some(a => a.vesselId === v.id && a.level !== "info");
                      return (
                        <li key={v.id}>
                          <button
                            className={cn(
                              "w-full text-left px-3 py-2.5 border-b border-cyan-900/20 hover:bg-cyan-900/10 transition-colors flex items-start gap-2",
                              selectedVessel?.id === v.id && "bg-cyan-900/20"
                            )}
                            onClick={() => handleSelectVessel(v)}
                            aria-label={`${v.name}, ${v.type}, ${v.status}, ${v.speedKnots} knots, heading to ${v.destinationPort.name}, ETA ${v.etaDays} days`}
                          >
                            <span className="text-lg mt-0.5" aria-hidden="true">
                              {v.type === "Container Ship"  ? "🚢" :
                               v.type === "Oil Tanker"      ? "🛢️" :
                               v.type === "Bulk Carrier"    ? "⛵" :
                               v.type === "LNG Carrier"     ? "🔵" :
                               v.type === "RoRo Vessel"     ? "🚗" : "🚢"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-100 truncate">{v.name}</span>
                                {hasAlert && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" aria-label="Alert" />}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 text-[10px]">
                                <span className={statusColor(v.status)}>{v.status}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-500">{v.speedKnots} kn</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-500">{v.voyageProgress}%</span>
                              </div>
                              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                {v.departurePort.flag} {v.departurePort.name} → {v.destinationPort.flag} {v.destinationPort.name}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </div>

              {/* Port status panel */}
              <div className="lg:col-span-3 rounded-xl border border-cyan-900/30 bg-[#030f1e] p-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Anchor className="h-3.5 w-3.5 text-cyan-500" aria-hidden="true" /> Port Status
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {PORTS.slice(0, 6).map(port => {
                    const arrivingVessels = vessels.filter(v => v.destinationPort.id === port.id);
                    return (
                      <div
                        key={port.id}
                        className="rounded-lg border border-cyan-900/20 bg-[#040d1c] px-2.5 py-2 text-center"
                        role="article"
                        aria-label={`${port.name}: ${arrivingVessels.length} vessels inbound`}
                      >
                        <div className="text-base" aria-hidden="true">{port.flag}</div>
                        <div className="text-[10px] font-semibold text-slate-200 mt-0.5">{port.name}</div>
                        <div className="text-[9px] text-slate-500">{port.country}</div>
                        <div className="mt-1 text-[10px] font-bold text-cyan-400">
                          {arrivingVessels.length} inbound
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Vessel Passport Tab ── */}
        {activeTab === "vessel" && (
          <section aria-labelledby={vesselHId}>
            <h2 id={vesselHId} className="sr-only">Vessel Passport</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Search panel */}
              <div className="rounded-xl border border-cyan-900/30 bg-[#030f1e] flex flex-col overflow-hidden">
                <div className="p-3 border-b border-cyan-900/30">
                  <label htmlFor="vessel-search" className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                    Search Vessels
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" aria-hidden="true" />
                    <Input
                      id="vessel-search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Name, IMO, MMSI, flag, type…"
                      className="pl-8 bg-[#040d1c] border-cyan-900/40 text-slate-100 placeholder:text-slate-600 h-8 text-xs"
                      aria-label="Search vessels by name, IMO number, MMSI, flag, vessel type, or port"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5" aria-live="polite">
                    {searchResults.length} vessel{searchResults.length !== 1 ? "s" : ""} found
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  <ul role="list" aria-label="Search results">
                    {searchResults.map(v => (
                      <li key={v.id}>
                        <button
                          className={cn(
                            "w-full text-left px-3 py-2.5 border-b border-cyan-900/20 hover:bg-cyan-900/10 transition-colors",
                            selectedVessel?.id === v.id && "bg-cyan-900/20"
                          )}
                          onClick={() => setSelectedVessel(v)}
                          aria-label={`${v.name}, IMO ${v.imo}, MMSI ${v.mmsi}, ${v.flag}, ${v.type}`}
                        >
                          <div className="text-xs font-semibold text-slate-100">{v.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">IMO {v.imo} · MMSI {v.mmsi}</div>
                          <div className="text-[10px] text-slate-500">{v.flagEmoji} {v.flag} · {v.type}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>

              {/* Vessel passport */}
              {selectedVessel ? (
                <div className="lg:col-span-2 rounded-xl border border-cyan-900/30 bg-[#030f1e] p-4 space-y-5" aria-label={`Vessel passport: ${selectedVessel.name}`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl" aria-hidden="true">{selectedVessel.flagEmoji}</span>
                        <h3 className="text-xl font-bold text-slate-100">{selectedVessel.name}</h3>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{selectedVessel.type}</p>
                    </div>
                    <span className={cn("text-xs font-bold px-2 py-1 rounded-full border",
                      selectedVessel.status === "Underway"  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
                      selectedVessel.status === "At Anchor" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" :
                                                              "border-sky-500/40 bg-sky-500/10 text-sky-400"
                    )}>
                      {selectedVessel.status}
                    </span>
                  </div>

                  {/* Registry */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      ["IMO Number",    selectedVessel.imo],
                      ["MMSI",         selectedVessel.mmsi],
                      ["Flag",         `${selectedVessel.flagEmoji} ${selectedVessel.flag}`],
                      ["Year Built",   selectedVessel.yearBuilt.toString()],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-[#040d1c] border border-cyan-900/20 px-3 py-2">
                        <div className="text-slate-500 text-[10px]">{k}</div>
                        <div className="text-slate-100 font-semibold mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ownership */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      ["Owner",    selectedVessel.owner],
                      ["Operator", selectedVessel.operator],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-[#040d1c] border border-cyan-900/20 px-3 py-2">
                        <div className="text-slate-500 text-[10px]">{k}</div>
                        <div className="text-slate-100 font-semibold mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Specs */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vessel Specifications</h4>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                      {[
                        ["Length",     `${selectedVessel.lengthM} m`],
                        ["Beam",       `${selectedVessel.beamM} m`],
                        ["Draft",      `${selectedVessel.draftM} m`],
                        ["GRT",        selectedVessel.grossTonnage.toLocaleString()],
                        ["Capacity",   selectedVessel.cargoCapacity],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded bg-[#040d1c] border border-cyan-900/20 px-2 py-1.5 text-center">
                          <div className="text-slate-500 text-[9px]">{k}</div>
                          <div className="text-slate-100 font-bold mt-0.5 text-[10px]">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Voyage */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Voyage</h4>
                    <div className="rounded-lg bg-[#040d1c] border border-cyan-900/20 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="h-3 w-3 text-slate-500" aria-hidden="true" />
                        <span className="text-slate-400">From:</span>
                        <span className="text-slate-100 font-semibold">{selectedVessel.departurePort.flag} {selectedVessel.departurePort.name}, {selectedVessel.departurePort.country}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Navigation className="h-3 w-3 text-cyan-500" aria-hidden="true" />
                        <span className="text-slate-400">To:</span>
                        <span className="text-slate-100 font-semibold">{selectedVessel.destinationPort.flag} {selectedVessel.destinationPort.name}, {selectedVessel.destinationPort.country}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500">Speed</div>
                          <div className="text-sm font-bold text-cyan-400">{selectedVessel.speedKnots} kn</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500">Heading</div>
                          <div className="text-sm font-bold text-cyan-400">{selectedVessel.heading}°</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[9px] text-slate-500">ETA</div>
                          <div className="text-sm font-bold text-cyan-400">{selectedVessel.etaDays}d</div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>Voyage progress</span>
                          <span>{selectedVessel.voyageProgress}%</span>
                        </div>
                        <Progress value={selectedVessel.voyageProgress} className="h-1.5 bg-slate-800" aria-label={`Voyage progress: ${selectedVessel.voyageProgress}%`} />
                      </div>
                    </div>
                  </div>

                  {/* Cargo */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cargo</h4>
                    <div className="rounded-lg bg-[#040d1c] border border-cyan-900/20 px-3 py-2 text-xs space-y-1">
                      <div className="flex gap-2">
                        <span className="text-slate-500">Type:</span>
                        <span className="text-slate-100">{selectedVessel.cargoType}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500">Details:</span>
                        <span className="text-slate-300">{selectedVessel.cargoDetails}</span>
                      </div>
                    </div>
                  </div>

                  {/* Weather */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Weather Conditions</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { icon: <Wind className="h-3 w-3" aria-hidden="true" />,     label: "Wind",   value: `${selectedVessel.weather.windKnots} kn` },
                        { icon: <Droplets className="h-3 w-3" aria-hidden="true" />, label: "Swell",  value: `${selectedVessel.weather.waveMeters} m`  },
                        { icon: <Gauge className="h-3 w-3" aria-hidden="true" />,    label: "Vis",    value: selectedVessel.weather.visibility          },
                        { icon: <Globe className="h-3 w-3" aria-hidden="true" />,    label: "Sky",    value: selectedVessel.weather.condition           },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="rounded bg-[#040d1c] border border-cyan-900/20 px-2 py-1.5 text-center">
                          <div className="flex justify-center text-slate-500 mb-0.5">{icon}</div>
                          <div className="text-[9px] text-slate-500">{label}</div>
                          <div className="text-[10px] font-semibold text-slate-100 mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="lg:col-span-2 rounded-xl border border-dashed border-cyan-900/30 bg-[#030f1e]/50 flex items-center justify-center" style={{ minHeight: 300 }}>
                  <div className="text-center text-slate-500">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                    <p className="text-sm">Select a vessel from the list or search by IMO/MMSI to view its passport.</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Logistics Tab ── */}
        {activeTab === "logistics" && (
          <section aria-labelledby={logHId}>
            <h2 id={logHId} className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-500" aria-hidden="true" />
              Maritime Logistics Command
            </h2>

            {!activeScenario ? (
              /* Scenario list */
              <div className="space-y-3">
                {SCENARIOS.map(s => {
                  const done    = completedScenarios.has(s.id);
                  const vessel  = vessels.find(v => v.id === s.vesselId);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        done
                          ? "border-emerald-900/30 bg-emerald-950/10 opacity-60"
                          : "border-cyan-900/30 bg-[#030f1e] hover:border-cyan-700/50 cursor-pointer"
                      )}
                      onClick={() => !done && handleOpenScenario(s)}
                      role={done ? "article" : "button"}
                      tabIndex={done ? undefined : 0}
                      onKeyDown={e => !done && e.key === "Enter" && handleOpenScenario(s)}
                      aria-label={done ? `Scenario ${s.title} completed` : `Handle scenario: ${s.title}. Urgency: ${s.urgency}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-label="Completed" />
                              : urgencyBadge(s.urgency)
                            }
                            <span className="text-sm font-bold text-slate-100">{s.title}</span>
                          </div>
                          {vessel && (
                            <p className="text-xs text-slate-500 mt-1">
                              Vessel: {vessel.name} · {vessel.type} · {vessel.flagEmoji} {vessel.flag}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{s.desc}</p>
                        </div>
                        {!done && <ChevronRight className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />}
                      </div>
                    </div>
                  );
                })}

                {completedScenarios.size === SCENARIOS.length && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center">
                    <Trophy className="h-8 w-8 text-yellow-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm font-bold text-emerald-300">All {SCENARIOS.length} scenarios resolved!</p>
                    <p className="text-xs text-slate-400 mt-1">Session complete. VX rewards disbursed to your wallet.</p>
                  </div>
                )}
              </div>
            ) : (
              /* Active scenario decision panel */
              <div className="rounded-xl border border-cyan-900/30 bg-[#030f1e] p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {urgencyBadge(activeScenario.urgency)}
                      <h3 className="text-base font-bold text-slate-100">{activeScenario.title}</h3>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{activeScenario.desc}</p>
                    {(() => {
                      const v = vessels.find(x => x.id === activeScenario.vesselId);
                      return v && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#040d1c] border border-cyan-900/30 px-3 py-1 text-xs text-slate-400">
                          <Ship className="h-3 w-3 text-cyan-500" aria-hidden="true" />
                          {v.name} · {v.type} · {v.speedKnots} kn · ETA {v.etaDays}d
                        </div>
                      );
                    })()}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setActiveScenario(null); setScenarioChoice(null); }}
                    className="text-slate-500 hover:text-slate-300 shrink-0"
                    aria-label="Back to scenario list"
                  >
                    ← Back
                  </Button>
                </div>

                {!scenarioChoice ? (
                  <div className="space-y-3" role="group" aria-label="Decision options">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select your response:</p>
                    {activeScenario.options.map((opt, i) => (
                      <button
                        key={opt.id}
                        className="w-full text-left rounded-lg border border-cyan-900/30 bg-[#040d1c] hover:border-cyan-600/50 hover:bg-cyan-950/20 transition-all p-4 space-y-1.5"
                        onClick={() => handleDecide(opt)}
                        aria-label={`Option ${i + 1}: ${opt.label}. ${opt.detail}. Delay: ${opt.delayHrs} hours. Cost: $${opt.costUSD.toLocaleString()}. VX reward: ${opt.vxReward}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">
                            {String.fromCharCode(65 + i)}. {opt.label}
                          </span>
                          <span className="text-xs text-cyan-400 font-semibold shrink-0">+{opt.vxReward} VX</span>
                        </div>
                        <p className="text-xs text-slate-400">{opt.detail}</p>
                        <div className="flex gap-3 text-[10px] text-slate-500">
                          <span><Clock className="inline h-2.5 w-2.5 mr-0.5" aria-hidden="true" />+{opt.delayHrs}h delay</span>
                          <span><Fuel className="inline h-2.5 w-2.5 mr-0.5" aria-hidden="true" />${opt.costUSD.toLocaleString()} cost</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "rounded-xl border p-5 space-y-3",
                      scenarioChoice.isOptimal ? "border-emerald-500/40 bg-emerald-950/20" : "border-amber-500/30 bg-amber-950/10"
                    )}
                    role="status"
                    aria-live="polite"
                    aria-label={`Decision outcome: ${scenarioChoice.label}. ${scenarioChoice.outcome}`}
                  >
                    <div className="flex items-center gap-2">
                      {scenarioChoice.isOptimal
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                        : <Info className="h-5 w-5 text-amber-400" aria-hidden="true" />
                      }
                      <span className="font-bold text-sm text-slate-100">
                        {scenarioChoice.isOptimal ? "Optimal Decision" : "Decision Recorded"}
                      </span>
                      <span className="ml-auto text-cyan-400 font-bold text-sm">+{scenarioChoice.vxReward} VX</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-300 mb-1">Selected: {scenarioChoice.label}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{scenarioChoice.outcome}</p>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Schedule impact: +{scenarioChoice.delayHrs}h</span>
                      <span>Cost: ${scenarioChoice.costUSD.toLocaleString()}</span>
                    </div>
                    <Button
                      onClick={() => { setActiveScenario(null); setScenarioChoice(null); }}
                      size="sm"
                      className="bg-cyan-700 hover:bg-cyan-600"
                    >
                      Next Scenario →
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── AI Bridge Tab ── */}
        {activeTab === "ai" && (
          <section aria-labelledby={aiHId} className="flex flex-col gap-4" style={{ minHeight: 500 }}>
            <h2 id={aiHId} className="text-base font-bold text-slate-200 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-500" aria-hidden="true" />
              AI Maritime Advisor
            </h2>

            <div className="rounded-xl border border-cyan-900/30 bg-[#030f1e] flex flex-col flex-1" style={{ minHeight: 420 }}>
              <div className="px-4 py-2 border-b border-cyan-900/30 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" aria-hidden="true" />
                <span className="text-xs text-slate-400">Fleet context loaded · Ask about vessel status, routing, or logistics</span>
              </div>
              <ScrollArea className="flex-1 px-4 py-3">
                {messages.length === 0 && (
                  <div className="py-8 text-center text-slate-500 text-sm space-y-3">
                    <Radar className="h-8 w-8 mx-auto text-slate-700" aria-hidden="true" />
                    <p>AI Maritime Advisor ready.<br />Ask about vessel status, routing decisions, or logistics emergencies.</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {[
                        "Which vessel has a critical alert?",
                        "What is the status of MV Nile Pioneer?",
                        "Recommend a safe route through Gulf of Aden.",
                        "Vessels arriving within 3 days?",
                      ].map(q => (
                        <button
                          key={q}
                          className="text-xs rounded-full border border-cyan-900/40 bg-[#040d1c] px-3 py-1.5 text-slate-400 hover:text-cyan-400 hover:border-cyan-700/60 transition-colors"
                          onClick={() => { setAiInput(q); }}
                          aria-label={`Suggested question: ${q}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map(m => (
                  <div
                    key={m.id}
                    className={cn(
                      "mb-3 rounded-lg px-3 py-2 max-w-[85%] text-sm leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-cyan-800/30 border border-cyan-700/30 text-slate-200"
                        : "bg-[#040d1c] border border-cyan-900/20 text-slate-300"
                    )}
                    aria-label={`${m.role === "user" ? "You" : "AI Advisor"}: ${m.content}`}
                  >
                    {m.content}
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3" aria-live="polite" aria-label="AI advisor is generating a response">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} aria-hidden="true" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} aria-hidden="true" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} aria-hidden="true" />
                  </div>
                )}
                <div ref={chatEndRef} />
              </ScrollArea>
              <div className="border-t border-cyan-900/30 p-3 flex gap-2">
                <label htmlFor="ai-input" className="sr-only">Ask the maritime AI advisor</label>
                <Textarea
                  id="ai-input"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAISend(); } }}
                  placeholder="Ask about vessel status, routing, port logistics…"
                  className="resize-none bg-[#040d1c] border-cyan-900/40 text-slate-100 placeholder:text-slate-600 text-sm"
                  rows={2}
                  aria-describedby="ai-hint"
                />
                <p id="ai-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</p>
                <Button
                  onClick={handleAISend}
                  disabled={!aiInput.trim() || aiLoading}
                  className="bg-cyan-700 hover:bg-cyan-600 self-end"
                  aria-label="Send message to AI advisor"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* ── Accessible Text View ── */}
        {activeTab === "accessible" && (
          <section aria-labelledby={accHId}>
            <h2 id={accHId} className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-500" aria-hidden="true" />
              Accessible Fleet Dashboard
            </h2>
            <div
              className="rounded-xl border border-cyan-900/30 bg-[#030f1e] p-5 space-y-6"
              aria-label="Full accessible text dashboard — all fleet data available without graphics"
            >

              {/* Active alerts */}
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  Active Alerts ({alerts.length})
                </h3>
                {alerts.length === 0
                  ? <p className="text-xs text-slate-500">No active alerts.</p>
                  : (
                    <ul className="space-y-2" aria-live="polite" aria-label="Fleet alerts">
                      {alerts.map(a => (
                        <li key={a.id} className={cn("rounded border px-3 py-2 text-xs flex gap-2", alertBg(a.level))}>
                          {alertIcon(a.level)}
                          <div>
                            <span className="font-semibold capitalize text-slate-200">{a.level}: </span>
                            <span className="text-slate-300">{a.message}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                }
              </div>

              {/* Mission progress */}
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-2">Mission Progress</h3>
                <p className="text-xs text-slate-400">
                  {completedScenarios.size} of {SCENARIOS.length} logistics scenarios resolved.
                  Score: {score.toLocaleString()} points. VX earned this session: {vxEarned.toLocaleString()}.
                </p>
              </div>

              {/* Full fleet table */}
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-3">Fleet Status Table</h3>
                <div role="table" aria-label="Complete fleet status" className="space-y-2">
                  <div role="row" className="hidden sm:grid grid-cols-5 gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                    <span role="columnheader">Vessel</span>
                    <span role="columnheader">Status / Speed</span>
                    <span role="columnheader">Voyage</span>
                    <span role="columnheader">ETA / Progress</span>
                    <span role="columnheader">Weather</span>
                  </div>
                  {vessels.map(v => (
                    <div
                      key={v.id}
                      role="row"
                      className="rounded-lg border border-cyan-900/20 bg-[#040d1c] p-3 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs"
                      aria-label={`${v.name}: ${v.status} at ${v.speedKnots} knots, heading ${v.heading} degrees. Voyage from ${v.departurePort.name} to ${v.destinationPort.name}. ETA ${v.etaDays} days, ${v.voyageProgress}% complete. Weather: ${v.weather.condition}, wind ${v.weather.windKnots} knots, swell ${v.weather.waveMeters} metres.`}
                    >
                      <div role="cell">
                        <div className="font-bold text-slate-100">{v.flagEmoji} {v.name}</div>
                        <div className="text-slate-500">{v.type}</div>
                      </div>
                      <div role="cell">
                        <span className={cn("font-semibold", statusColor(v.status))}>{v.status}</span>
                        <div className="text-slate-500">{v.speedKnots} kn · {v.heading}°</div>
                      </div>
                      <div role="cell">
                        <div className="text-slate-300">{v.departurePort.flag} {v.departurePort.name}</div>
                        <div className="text-slate-300">→ {v.destinationPort.flag} {v.destinationPort.name}</div>
                      </div>
                      <div role="cell">
                        <div className="text-slate-300">ETA {v.etaDays} days</div>
                        <Progress value={v.voyageProgress} className="h-1.5 mt-1 bg-slate-800" aria-label={`${v.voyageProgress}% complete`} />
                      </div>
                      <div role="cell">
                        <div className="text-slate-300">{v.weather.condition}</div>
                        <div className="text-slate-500">🌬️ {v.weather.windKnots} kn · 🌊 {v.weather.waveMeters} m</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending scenarios */}
              {pendingScenarios.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-300 mb-2">Pending Logistics Decisions ({pendingScenarios.length})</h3>
                  <ul className="space-y-2">
                    {pendingScenarios.map(s => {
                      const v = vessels.find(x => x.id === s.vesselId);
                      return (
                        <li key={s.id} className="rounded-lg border border-cyan-900/20 bg-[#040d1c] px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            {urgencyBadge(s.urgency)}
                            <span className="font-bold text-slate-100">{s.title}</span>
                          </div>
                          {v && <p className="text-slate-500">Vessel: {v.name} ({v.type})</p>}
                          <p className="text-slate-400">{s.desc}</p>
                          <Button
                            size="sm"
                            onClick={() => { handleOpenScenario(s); setActiveTab("logistics"); }}
                            className="mt-1 h-7 bg-cyan-800 hover:bg-cyan-700 text-xs"
                          >
                            Handle Emergency →
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Position updates */}
              <div aria-live="polite" aria-atomic="true" className="sr-only">
                {positionTick > 0 && `Fleet position update ${positionTick}. All vessels nominal.`}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer stats */}
      <footer className="border-t border-cyan-900/30 mt-6 bg-[#030f1e] px-4 py-3">
        <div className="mx-auto max-w-7xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div>
            <div className="font-bold text-cyan-400 text-sm" aria-label={`${vessels.length} vessels active`}>{vessels.length}</div>
            <div className="text-slate-500">Vessels Active</div>
          </div>
          <div>
            <div className="font-bold text-amber-400 text-sm" aria-label={`${alerts.length} fleet alerts`}>{alerts.length}</div>
            <div className="text-slate-500">Fleet Alerts</div>
          </div>
          <div>
            <div className="font-bold text-emerald-400 text-sm" aria-label={`${score.toLocaleString()} mission score`}>{score.toLocaleString()}</div>
            <div className="text-slate-500">Mission Score</div>
          </div>
          <div>
            <div className="font-bold text-cyan-400 text-sm" aria-label={`${vxEarned.toLocaleString()} VX earned`}>{vxEarned.toLocaleString()}</div>
            <div className="text-slate-500">VX Earned</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
