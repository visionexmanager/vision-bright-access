import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useScreenReader } from "@/hooks/useScreenReader";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { useVXWallet } from "@/hooks/useVXWallet";
import { useTrial } from "@/hooks/useTrial";
import { useEarnPoints } from "@/hooks/useEarnPoints";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Wrench,
  Zap,
  Activity,
  Settings,
  RotateCcw,
  Trophy,
  Car,
  CheckCircle2,
  ChevronRight,
  Search,
  Cpu,
  Shield,
  CircleDot,
} from "lucide-react";
import { SimulationMentor } from "@/components/SimulationMentor";
import { SimulationScene } from "@/components/SimulationScene";
import { cn } from "@/lib/utils";

interface Props {
  simulationId?: string;
}

// ── Vehicle data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "car", label: "Cars", icon: "🚗" },
  { id: "truck", label: "Heavy Trucks", icon: "🚛" },
  { id: "bus", label: "Buses", icon: "🚌" },
  { id: "motorcycle", label: "Motorcycles", icon: "🏍️" },
];

const MANUFACTURERS: Record<string, string[]> = {
  car: [
    "Toyota", "Ford", "BMW", "Mercedes-Benz", "Honda",
    "Chevrolet", "Nissan", "Hyundai", "Kia", "Volkswagen",
    "Audi", "Jeep", "Tesla", "Mazda", "Subaru",
  ],
  truck: [
    "Freightliner", "Peterbilt", "Kenworth", "Volvo", "International",
    "Western Star", "Mack", "Ford", "Chevrolet", "RAM",
  ],
  bus: [
    "Mercedes-Benz", "Volvo", "MAN", "Scania", "Iveco",
    "Blue Bird", "Thomas Built", "IC Bus", "Gillig", "New Flyer",
  ],
  motorcycle: [
    "Honda", "Yamaha", "Kawasaki", "Suzuki", "Harley-Davidson",
    "BMW", "KTM", "Ducati", "Triumph", "Royal Enfield",
  ],
};

const MODELS: Record<string, string[]> = {
  Toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "4Runner", "Tundra", "Prius"],
  Ford: ["F-150", "Mustang", "Explorer", "Escape", "Ranger", "Bronco", "F-250 Super Duty", "Expedition"],
  BMW: ["3 Series", "5 Series", "7 Series", "X3", "X5", "M3", "M5", "X7"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLC", "GLE", "A-Class", "Sprinter", "AMG GT"],
  Honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Odyssey", "Ridgeline", "Passport"],
  Chevrolet: ["Silverado", "Malibu", "Equinox", "Traverse", "Tahoe", "Colorado", "Camaro", "Suburban"],
  Nissan: ["Altima", "Sentra", "Maxima", "Rogue", "Murano", "Pathfinder", "Titan", "Leaf"],
  Hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Palisade", "Kona", "Ioniq 5", "Accent"],
  Kia: ["Sportage", "Sorento", "Telluride", "Forte", "K5", "Soul", "EV6", "Stinger"],
  Volkswagen: ["Jetta", "Passat", "Tiguan", "Atlas", "Golf", "ID.4", "Arteon", "GTI"],
  Audi: ["A4", "A6", "Q5", "Q7", "A3", "e-tron", "A8", "RS6"],
  Jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Gladiator", "Renegade"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  Mazda: ["Mazda3", "Mazda6", "CX-5", "CX-9", "MX-5 Miata", "CX-30"],
  Subaru: ["Outback", "Forester", "Crosstrek", "Impreza", "WRX", "Ascent"],
  Freightliner: ["Cascadia", "M2 106", "114SD", "122SD", "Sprinter"],
  Peterbilt: ["389", "579", "567", "536", "520"],
  Kenworth: ["T680", "T880", "W900", "T270", "T370"],
  Volvo: ["VNL 860", "VNL 780", "FH16", "FM", "B8R"],
  International: ["LT Series", "RH Series", "HX Series", "MV Series", "LoneStar"],
  "Western Star": ["5700XE", "4900FA", "4700SB", "6900XD"],
  Mack: ["Anthem", "Pinnacle", "Granite", "LR"],
  RAM: ["1500", "2500", "3500", "ProMaster"],
  GMC: ["Sierra 1500", "Sierra 2500HD", "Yukon", "Canyon"],
  Scania: ["R Series", "S Series", "G Series", "P Series"],
  MAN: ["TGX", "TGS", "TGL", "TGM"],
  Iveco: ["Stralis", "S-WAY", "Daily", "Eurocargo"],
  "Blue Bird": ["Vision", "All American", "Micro Bird"],
  "Thomas Built": ["Saf-T-Liner C2", "Saf-T-Liner EFX", "Minotour"],
  "IC Bus": ["CE Series", "RE Series", "BE Series"],
  Gillig: ["Advantage", "BRT", "Low Floor"],
  "New Flyer": ["XD40", "XDE40", "Xcelsior"],
  Yamaha: ["YZF-R1", "MT-09", "Tenere 700", "TMAX", "R6", "MT-07"],
  Kawasaki: ["Ninja 400", "Z900", "Versys 650", "Ninja H2", "Z650"],
  Suzuki: ["GSX-R1000", "V-Strom 1050", "Hayabusa", "SV650"],
  "Harley-Davidson": ["Street Glide", "Road King", "Fat Boy", "Sportster", "Iron 883"],
  KTM: ["Duke 390", "Adventure 1290", "RC 390", "EXC 300", "Duke 890"],
  Ducati: ["Panigale V4", "Monster", "Multistrada V4", "Scrambler"],
  Triumph: ["Bonneville", "Street Triple", "Tiger 900", "Speed Triple"],
  "Royal Enfield": ["Classic 350", "Meteor 350", "Himalayan", "Thunderbird"],
};

const YEARS = Array.from({ length: 16 }, (_, i) => String(2025 - i));

const EV_MAKES = new Set(["Tesla"]);
const HEAVY_TRUCK_MAKES = new Set(["Freightliner", "Peterbilt", "Kenworth", "Western Star", "Mack", "International", "Volvo", "Scania", "MAN"]);

// ── Systems ───────────────────────────────────────────────────────────────────

interface SystemEntry {
  id: string;
  name: string;
  icon: string;
}

const BASE_CAR_SYSTEMS: SystemEntry[] = [
  { id: "engine",       name: "Engine & Fuel System",       icon: "⚙️" },
  { id: "transmission", name: "Transmission & Drivetrain",  icon: "🔄" },
  { id: "brakes",       name: "Brake System (ABS)",         icon: "🛑" },
  { id: "electrical",   name: "Electrical & Electronics",   icon: "⚡" },
  { id: "suspension",   name: "Suspension & Steering",      icon: "🔧" },
  { id: "cooling",      name: "Cooling System",             icon: "🌡️" },
  { id: "exhaust",      name: "Exhaust & Emissions",        icon: "💨" },
  { id: "hvac",         name: "HVAC System",                icon: "❄️" },
];

const TRUCK_SYSTEMS: SystemEntry[] = [
  { id: "engine",       name: "Engine & Fuel System",       icon: "⚙️" },
  { id: "diesel_turbo", name: "Diesel Turbo & Injection",   icon: "💨" },
  { id: "transmission", name: "Transmission & Drivetrain",  icon: "🔄" },
  { id: "air_brakes",   name: "Air Brake System (J1939)",   icon: "🛑" },
  { id: "electrical",   name: "Electrical & Electronics",   icon: "⚡" },
  { id: "suspension",   name: "Suspension & Axle",          icon: "🔧" },
  { id: "exhaust",      name: "Exhaust & DPF System",       icon: "💨" },
  { id: "cooling",      name: "Cooling System",             icon: "🌡️" },
];

const BUS_SYSTEMS: SystemEntry[] = [
  { id: "engine",       name: "Engine & Fuel System",       icon: "⚙️" },
  { id: "transmission", name: "Transmission",               icon: "🔄" },
  { id: "air_brakes",   name: "Air Brake System (J1939)",   icon: "🛑" },
  { id: "electrical",   name: "Electrical & Electronics",   icon: "⚡" },
  { id: "hvac",         name: "HVAC / Passenger Comfort",   icon: "❄️" },
  { id: "diesel_turbo", name: "Diesel Turbo & Injection",   icon: "💨" },
];

const MOTO_SYSTEMS: SystemEntry[] = [
  { id: "engine",       name: "Engine & Carburetor",        icon: "⚙️" },
  { id: "electrical",   name: "Electrical System",          icon: "⚡" },
  { id: "brakes",       name: "Brake System",               icon: "🛑" },
  { id: "fuel",         name: "Fuel System & Injection",    icon: "⛽" },
  { id: "transmission", name: "Gearbox & Chain Drive",      icon: "🔄" },
  { id: "suspension",   name: "Suspension & Forks",         icon: "🔧" },
];

const EV_EXTRA_SYSTEMS: SystemEntry[] = [
  { id: "hv_battery", name: "High-Voltage Battery Pack",   icon: "🔋" },
  { id: "inverter",   name: "Inverter & Motor Controller", icon: "💡" },
  { id: "charging",   name: "Charging System & BMS",       icon: "🔌" },
  { id: "thermal",    name: "Thermal Management System",   icon: "🌡️" },
];

function getSystemsForVehicle(category: string, make: string): SystemEntry[] {
  if (category === "truck" || HEAVY_TRUCK_MAKES.has(make)) return TRUCK_SYSTEMS;
  if (category === "bus") return BUS_SYSTEMS;
  if (category === "motorcycle") return MOTO_SYSTEMS;
  const base = [...BASE_CAR_SYSTEMS];
  if (EV_MAKES.has(make)) {
    // Replace engine / exhaust with EV-specific systems
    return [...base.filter(s => !["engine", "exhaust"].includes(s.id)), ...EV_EXTRA_SYSTEMS];
  }
  return base;
}

// ── DTC Database ──────────────────────────────────────────────────────────────

interface DTCRecord {
  code: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  system: string;
}

const ALL_DTCS: DTCRecord[] = [
  // Engine
  { code: "P0300", description: "Random/Multiple Cylinder Misfire Detected",              severity: "high",     system: "engine" },
  { code: "P0301", description: "Cylinder 1 Misfire Detected",                            severity: "high",     system: "engine" },
  { code: "P0171", description: "System Too Lean (Bank 1)",                               severity: "medium",   system: "engine" },
  { code: "P0174", description: "System Too Lean (Bank 2)",                               severity: "medium",   system: "engine" },
  { code: "P0102", description: "Mass or Volume Air Flow Circuit Low Input",               severity: "medium",   system: "engine" },
  { code: "P0113", description: "Intake Air Temperature Circuit High Input",               severity: "low",      system: "engine" },
  { code: "P0340", description: "Camshaft Position Sensor Circuit Malfunction (Bank 1)",  severity: "high",     system: "engine" },
  { code: "P0016", description: "Crankshaft/Camshaft Position Correlation Fault",         severity: "high",     system: "engine" },
  { code: "P0172", description: "System Too Rich (Bank 1)",                               severity: "medium",   system: "engine" },
  // Transmission
  { code: "P0700", description: "Transmission Control System Malfunction",                severity: "high",     system: "transmission" },
  { code: "P0730", description: "Incorrect Gear Ratio",                                   severity: "high",     system: "transmission" },
  { code: "P0741", description: "Torque Converter Clutch Circuit — Stuck Off",            severity: "medium",   system: "transmission" },
  { code: "P0760", description: "Shift Solenoid C Malfunction",                           severity: "medium",   system: "transmission" },
  { code: "P0720", description: "Output Speed Sensor Circuit Malfunction",                severity: "medium",   system: "transmission" },
  // Brakes
  { code: "C0031", description: "Right Front Wheel Speed Sensor Circuit Malfunction",     severity: "critical", system: "brakes" },
  { code: "C0035", description: "Left Front Wheel Speed Sensor Circuit",                  severity: "critical", system: "brakes" },
  { code: "C0040", description: "Right Front Wheel Speed Circuit Range/Performance",      severity: "high",     system: "brakes" },
  { code: "C0110", description: "ABS Motor Circuit Malfunction",                          severity: "high",     system: "brakes" },
  { code: "C1210", description: "ABS Solenoid Valve Relay Circuit Failure",               severity: "critical", system: "brakes" },
  // Electrical
  { code: "B1000", description: "Control Module — Internal Failure",                      severity: "critical", system: "electrical" },
  { code: "U0100", description: "Lost Communication With ECM/PCM",                        severity: "critical", system: "electrical" },
  { code: "U0155", description: "Lost Communication With Instrument Panel Cluster",       severity: "high",     system: "electrical" },
  { code: "P0562", description: "System Voltage Low",                                     severity: "medium",   system: "electrical" },
  { code: "P0563", description: "System Voltage High",                                    severity: "medium",   system: "electrical" },
  // Suspension
  { code: "C0455", description: "Steering Angle Sensor Circuit Range/Performance",        severity: "medium",   system: "suspension" },
  { code: "C0710", description: "Steering Position Signal Malfunction",                   severity: "medium",   system: "suspension" },
  { code: "C1230", description: "Rear Wheel Speed Sensor Range/Performance",              severity: "high",     system: "suspension" },
  // Cooling
  { code: "P0115", description: "Engine Coolant Temperature Circuit Malfunction",         severity: "medium",   system: "cooling" },
  { code: "P0216", description: "Engine Coolant Over-Temperature Condition",              severity: "critical", system: "cooling" },
  { code: "P0128", description: "Coolant Temp Below Thermostat Regulating Temperature",  severity: "low",      system: "cooling" },
  // Exhaust
  { code: "P0420", description: "Catalyst System Efficiency Below Threshold (Bank 1)",   severity: "medium",   system: "exhaust" },
  { code: "P0430", description: "Catalyst System Efficiency Below Threshold (Bank 2)",   severity: "medium",   system: "exhaust" },
  { code: "P2002", description: "Diesel Particulate Filter Efficiency Below Threshold",  severity: "high",     system: "exhaust" },
  { code: "P2452", description: "Diesel Particulate Filter Pressure Sensor A Circuit",   severity: "medium",   system: "exhaust" },
  // Diesel Turbo
  { code: "P003A", description: "Turbocharger Boost Control A — Position Exceeded Limit",severity: "high",     system: "diesel_turbo" },
  { code: "P0046", description: "Turbo Boost Control Solenoid Circuit Range/Performance",severity: "high",     system: "diesel_turbo" },
  { code: "P0087", description: "Fuel Rail/System Pressure — Too Low",                   severity: "critical", system: "diesel_turbo" },
  { code: "P0670", description: "Glow Plug Module Control Circuit",                      severity: "medium",   system: "diesel_turbo" },
  // Air Brakes (J1939 format)
  { code: "SA00",  description: "J1939 SPN 597 — Brake Switch FMI 4: Voltage Below Normal",   severity: "critical", system: "air_brakes" },
  { code: "SA01",  description: "J1939 SPN 116 — Brake Application Pressure FMI 3: V Above Normal", severity: "high", system: "air_brakes" },
  { code: "SA02",  description: "J1939 SPN 1633 — Park Brake Command FMI 2: Data Erratic",    severity: "medium",   system: "air_brakes" },
  { code: "SA03",  description: "J1939 SPN 2911 — Air Supply Pressure Low Warning",           severity: "critical", system: "air_brakes" },
  // HVAC
  { code: "B1414", description: "Interior/Exterior Temperature Sensor Open Circuit",     severity: "low",      system: "hvac" },
  { code: "B1432", description: "Blower Motor Speed Sensor Circuit Failure",             severity: "medium",   system: "hvac" },
  // Fuel
  { code: "P0089", description: "Fuel Pressure Regulator 1 Performance",                severity: "high",     system: "fuel" },
  { code: "P0175", description: "System Too Rich (Bank 2)",                              severity: "medium",   system: "fuel" },
  // HV Battery
  { code: "P0AA0", description: "Hybrid Battery Pack — Voltage System Isolation Fault", severity: "critical", system: "hv_battery" },
  { code: "P0AA6", description: "Hybrid Battery — Voltage System Isolation Fault",      severity: "critical", system: "hv_battery" },
  { code: "P0C4F", description: "Battery Cell Temperature Sensor Circuit High",          severity: "high",     system: "hv_battery" },
  { code: "P0A0F", description: "Drive Motor A Performance",                             severity: "high",     system: "hv_battery" },
  { code: "P0A80", description: "Replace Hybrid/EV Battery Pack",                       severity: "critical", system: "hv_battery" },
  // Inverter
  { code: "P0A93", description: "Inverter Cooling System Performance",                   severity: "high",     system: "inverter" },
  { code: "P0A1F", description: "Battery Energy Control Module Performance",             severity: "high",     system: "inverter" },
  { code: "P0D3B", description: "Drive Motor Inverter Performance",                      severity: "critical", system: "inverter" },
  // Charging
  { code: "P0AA6C", description: "Charging System — Isolation Fault (AC)",              severity: "critical", system: "charging" },
  // Thermal
  { code: "P0A9B", description: "HV Battery Cooling Fan Speed Low",                     severity: "high",     system: "thermal" },
];

const DTC_BY_CODE: Record<string, DTCRecord> = Object.fromEntries(ALL_DTCS.map(d => [d.code, d]));

function getDTCsForSystem(systemId: string): DTCRecord[] {
  return ALL_DTCS.filter(d => d.system === systemId);
}

// ── Repair procedures ─────────────────────────────────────────────────────────

interface RepairProcedure {
  steps: string[];
  parts: string[];
  tools: string[];
  timeMin: number;
  estimatedCost: number;
  vxReward: number;
}

const REPAIR_PROCEDURES: Record<string, RepairProcedure> = {
  P0300: {
    steps: ["Inspect spark plugs for wear and carbon fouling", "Test ignition coils with multimeter (resistance 0.4–2Ω)", "Check compression on all cylinders (spec ±10%)", "Replace faulty coil(s) / spark plugs with OEM spec", "Clear DTCs and perform 50-mile drive cycle"],
    parts: ["Spark Plugs Set (x4–6)", "Ignition Coil Pack"],
    tools: ["obd_scanner", "multimeter", "torque_wrench"],
    timeMin: 90, estimatedCost: 180, vxReward: 800,
  },
  P0171: {
    steps: ["Perform smoke test for vacuum and intake leaks", "Clean MAF sensor with electronics cleaner", "Test fuel pressure (spec: 40–60 PSI)", "Inspect fuel injectors for clogging or drip-back", "Replace vacuum hoses / MAF if faulty"],
    parts: ["MAF Sensor", "Vacuum Hose Kit", "Fuel Filter"],
    tools: ["obd_scanner", "smoke_machine", "fuel_gauge", "cleaner"],
    timeMin: 120, estimatedCost: 250, vxReward: 750,
  },
  P0420: {
    steps: ["Test upstream and downstream O2 sensors (duty cycle 10–90%)", "Check exhaust manifold for cracks or leaks before CAT", "Inspect for oil or coolant entering exhaust stream", "Replace catalytic converter with direct-fit unit", "Run full OBDII readiness drive cycle to confirm pass"],
    parts: ["Catalytic Converter", "O2 Sensors (pair)"],
    tools: ["obd_scanner", "multimeter", "impact_gun"],
    timeMin: 180, estimatedCost: 900, vxReward: 1200,
  },
  P0700: {
    steps: ["Pull transmission-specific sub-codes from TCM", "Check transmission fluid — level, color, and smell", "Inspect TCM wiring harness for chafe or corrosion", "Perform solenoid pack resistance tests", "Replace faulty solenoid or TCM module"],
    parts: ["TCM Module", "Shift Solenoid", "Transmission Fluid (6 qts)"],
    tools: ["obd_scanner", "multimeter", "torque_wrench"],
    timeMin: 240, estimatedCost: 800, vxReward: 1000,
  },
  P0087: {
    steps: ["Measure live fuel rail pressure with gauge (spec per service manual)", "Inspect fuel filter — replace if over 30,000 miles", "Test fuel pump amperage draw (spec: 4–8A)", "Check fuel pressure regulator return line", "Replace fuel pump assembly if below specification"],
    parts: ["Fuel Pump Assembly", "Fuel Filter", "Fuel Pressure Regulator"],
    tools: ["fuel_gauge", "obd_scanner", "multimeter"],
    timeMin: 150, estimatedCost: 450, vxReward: 900,
  },
  P0128: {
    steps: ["Allow engine to reach full operating temperature", "Monitor coolant temperature PID vs. thermostat spec", "Inspect thermostat housing for leaks or bypass", "Replace thermostat with OEM temp-rated unit", "Bleed cooling system and verify temp stabilizes"],
    parts: ["Thermostat", "Thermostat Housing Gasket", "Coolant"],
    tools: ["obd_scanner", "torque_wrench"],
    timeMin: 60, estimatedCost: 120, vxReward: 500,
  },
  C0031: {
    steps: ["Inspect ABS wheel speed sensor ring for damage or missing teeth", "Check sensor wiring for cuts, pinching, or corrosion", "Measure sensor resistance (spec: 800–1400Ω)", "Test sensor output on oscilloscope at low speed roll", "Replace sensor and clear DTC — verify signal on test drive"],
    parts: ["ABS Wheel Speed Sensor (front right)", "Sensor Wiring Pigtail"],
    tools: ["obd_scanner", "multimeter", "oscilloscope"],
    timeMin: 75, estimatedCost: 160, vxReward: 700,
  },
  U0100: {
    steps: ["Check CAN bus fuses and OBDII power/ground pins", "Inspect ECM ground straps for corrosion or loose connections", "Check for damaged wiring in CAN-H / CAN-L harness", "Test CAN bus resistance between H and L (spec: 60Ω)", "Replace ECM or repair harness as indicated"],
    parts: ["ECM Fuse Set", "CAN Bus Wiring Repair Kit"],
    tools: ["obd_scanner", "multimeter"],
    timeMin: 120, estimatedCost: 600, vxReward: 1100,
  },
  P0046: {
    steps: ["Read boost pressure PID — compare actual vs. commanded boost", "Inspect turbo boost control solenoid — test coil resistance (20–30Ω)", "Check intercooler hoses for splits or disconnection", "Test variable-geometry vanes for binding (if applicable)", "Replace boost control solenoid or turbocharger as needed"],
    parts: ["Boost Control Solenoid", "Intercooler Hose Kit"],
    tools: ["obd_scanner", "multimeter", "torque_wrench"],
    timeMin: 130, estimatedCost: 380, vxReward: 950,
  },
  SA03: {
    steps: ["Check air compressor belt tension and condition", "Test air dryer cartridge with soap-water for leaks", "Inspect supply lines from compressor to tanks", "Check governor valve cut-in/cut-out pressure (spec: 105/120 PSI)", "Replace air dryer cartridge and reseal supply lines"],
    parts: ["Air Dryer Cartridge", "Air Line Fittings", "Governor Valve"],
    tools: ["obd_scanner", "fuel_gauge"],
    timeMin: 120, estimatedCost: 350, vxReward: 850,
  },
  P0AA0: {
    steps: ["Enable high-voltage safety protocol (PPE required)", "Perform HV bus isolation test with insulation tester (>500kΩ)", "Visually inspect all HV orange cables for damage", "Test individual battery module voltages (spec varies by pack)", "Replace damaged HV cable or faulty module — recalibrate BMS"],
    parts: ["HV Battery Module", "HV Cable Assembly", "Thermal Paste"],
    tools: ["obd_scanner", "multimeter"],
    timeMin: 300, estimatedCost: 3500, vxReward: 2000,
  },
  P2002: {
    steps: ["Check DPF differential pressure reading vs. specification", "Initiate forced DPF regeneration cycle via scan tool", "Inspect for short-trip driving patterns inhibiting passive regen", "Clean DPF externally if regen fails (ash over limit)", "Replace DPF if cracked or internally blocked"],
    parts: ["DPF Filter", "DPF Pressure Sensor"],
    tools: ["obd_scanner", "torque_wrench"],
    timeMin: 200, estimatedCost: 1800, vxReward: 1400,
  },
};

function getRepairProcedure(code: string): RepairProcedure {
  return (
    REPAIR_PROCEDURES[code] ?? {
      steps: ["Inspect the reported system for visible damage", "Test electrical connections and sensor outputs", "Consult service manual for component-specific test procedure", "Replace faulty component with OEM or equivalent", "Clear DTCs, verify fix with drive cycle"],
      parts: ["Component as per DTC", "Seals / Gaskets"],
      tools: ["obd_scanner", "multimeter", "torque_wrench"],
      timeMin: 90, estimatedCost: 300, vxReward: 600,
    }
  );
}

// ── Tool catalogue ─────────────────────────────────────────────────────────────

const TOOLBOX = [
  { id: "obd_scanner",  name: "OBD-II Scanner",       icon: "📟", desc: "Reads & clears ECU fault codes"               },
  { id: "multimeter",   name: "Digital Multimeter",    icon: "⚡", desc: "Tests voltage, resistance, continuity"        },
  { id: "torque_wrench",name: "Torque Wrench",         icon: "🔩", desc: "Applies precision torque to fasteners"        },
  { id: "impact_gun",   name: "Impact Gun",            icon: "🔧", desc: "High-torque removal of seized hardware"       },
  { id: "cleaner",      name: "Component Cleaner",     icon: "🧪", desc: "Cleans sensors, contacts, and components"     },
  { id: "fuel_gauge",   name: "Fuel Pressure Gauge",   icon: "⛽", desc: "Measures fuel rail & system pressure"         },
  { id: "smoke_machine",name: "Smoke Machine",         icon: "💨", desc: "Detects vacuum and intake leaks"              },
  { id: "oscilloscope", name: "Oscilloscope",          icon: "📊", desc: "Analyzes sensor waveforms and signals"        },
];

// ── AI keyword parser (Mode A) ────────────────────────────────────────────────

interface ParseResult {
  dtcCode: string;
  confidence: number;
  reasoning: string;
}

function parseSymptomToFault(text: string, systemId: string): ParseResult {
  const t = text.toLowerCase();

  const rules: Array<{ keywords: string[]; code: string; reasoning: string }> = [
    { keywords: ["shake", "shak", "vibrat", "rough", "misfire", "stumble", "sputter"], code: "P0300", reasoning: "Vibration and roughness at idle or under load are classic misfire patterns → P0300." },
    { keywords: ["lean", "vac leak", "vacuum", "hiss", "surge", "white smoke"], code: "P0171", reasoning: "Lean running condition with possible vacuum leak → P0171 / P0174." },
    { keywords: ["cat", "catalyst", "emission", "smog fail", "o2", "oxygen"], code: "P0420", reasoning: "Catalyst efficiency below threshold flagged by downstream O2 sensor → P0420." },
    { keywords: ["slip", "gear slip", "no shift", "stuck gear", "trans"], code: "P0700", reasoning: "Transmission control system fault causing slip or shift issues → P0700." },
    { keywords: ["fuel", "low pressure", "fuel pump", "hard start", "crank"], code: "P0087", reasoning: "Insufficient fuel rail pressure — pump or filter suspect → P0087." },
    { keywords: ["cold", "overheat", "cool", "therm", "temp", "radiator"], code: "P0128", reasoning: "Coolant temperature deviation from thermostat spec → P0128." },
    { keywords: ["abs", "wheel speed", "traction", "stability", "skid"], code: "C0031", reasoning: "ABS or traction control malfunction related to wheel speed sensor → C0031." },
    { keywords: ["no com", "no scan", "won't communicate", "bus", "can"], code: "U0100", reasoning: "Scanner cannot communicate with ECM — CAN bus or ECM fault → U0100." },
    { keywords: ["boost", "turbo", "wastegate", "intercooler", "black smoke"], code: "P0046", reasoning: "Turbocharger boost control deviation → P0046." },
    { keywords: ["air brake", "low air", "brake warning", "park brake", "air pressure"], code: "SA03", reasoning: "Air supply pressure warning — compressor or dryer issue → SA03." },
    { keywords: ["battery", "range", "isolation", "hv", "high volt", "orange cable"], code: "P0AA0", reasoning: "HV system isolation fault in EV battery pack → P0AA0." },
    { keywords: ["dpf", "particulate", "regen", "diesel filter", "back pressure"], code: "P2002", reasoning: "DPF efficiency below threshold — regeneration failure → P2002." },
    { keywords: ["fan", "blower", "hvac", "no heat", "no cool", "ac"], code: "B1432", reasoning: "HVAC blower motor or speed sensor fault → B1432." },
    { keywords: ["rich", "black smoke", "fuel smell", "excess fuel"], code: "P0172", reasoning: "Over-fuelling / rich running condition → P0172." },
    { keywords: ["camshaft", "timing", "vvt", "variable valve", "chain rattle"], code: "P0016", reasoning: "Camshaft/crankshaft correlation fault — timing chain or VVT → P0016." },
  ];

  const systemDTCs = getDTCsForSystem(systemId).map(d => d.code);

  // Score each rule
  let bestRule: (typeof rules[0] & { score: number }) | null = null;
  for (const rule of rules) {
    if (!systemDTCs.includes(rule.code)) continue;
    const score = rule.keywords.filter(k => t.includes(k)).length;
    if (score > 0 && (!bestRule || score > bestRule.score)) {
      bestRule = { ...rule, score };
    }
  }

  if (bestRule) {
    const confidence = Math.min(95, 55 + bestRule.score * 15);
    return { dtcCode: bestRule.code, confidence, reasoning: bestRule.reasoning };
  }

  // Fallback: pick first DTC in system
  const fallback = getDTCsForSystem(systemId)[0] ?? ALL_DTCS[0];
  return {
    dtcCode: fallback.code,
    confidence: 38,
    reasoning: "Symptom description is ambiguous. Defaulting to most common fault in selected system. A physical scan is strongly recommended.",
  };
}

// ── Question trees (Mode B) ───────────────────────────────────────────────────

interface QuestionNode {
  id: string;
  question: string;
  options: Array<{ text: string; nextId?: string; faultCode?: string }>;
}

const QUESTION_TREES: Record<string, QuestionNode[]> = {
  engine: [
    { id: "q1", question: "When does the engine issue occur?", options: [
      { text: "Cold start only / goes away when warm", nextId: "q_cold" },
      { text: "Constant rough idle", faultCode: "P0300" },
      { text: "Under load / acceleration", nextId: "q_load" },
      { text: "Random / intermittent", faultCode: "P0300" },
    ]},
    { id: "q_cold", question: "What does cold start behavior look like?", options: [
      { text: "Takes long time to warm up, gauge stays low", faultCode: "P0128" },
      { text: "Hard to start — cranks a long time", faultCode: "P0340" },
      { text: "Starts then stalls within 30 seconds", faultCode: "P0087" },
      { text: "Blue or white smoke on startup", faultCode: "P0171" },
    ]},
    { id: "q_load", question: "What happens under acceleration?", options: [
      { text: "Hesitation / stumble off the line", faultCode: "P0102" },
      { text: "Loss of power / feels sluggish", faultCode: "P0016" },
      { text: "CEL flashes while driving fast", faultCode: "P0300" },
      { text: "Black smoke from exhaust pipe", faultCode: "P0172" },
    ]},
  ],
  brakes: [
    { id: "q1", question: "What brake symptom are you experiencing?", options: [
      { text: "ABS warning light on dash", nextId: "q_abs" },
      { text: "Brake pedal feels soft / goes to floor", faultCode: "C1210" },
      { text: "Vehicle pulls to one side when braking", faultCode: "C0031" },
      { text: "Grinding or squealing noise", nextId: "q_noise" },
    ]},
    { id: "q_abs", question: "Does the ABS activate at wrong times?", options: [
      { text: "Yes — triggers on normal dry stops", faultCode: "C0035" },
      { text: "No — light on but brakes seem normal", faultCode: "C0031" },
      { text: "ABS + traction control lights both on", faultCode: "C0110" },
      { text: "Only activates on wet/slippery roads", faultCode: "C0040" },
    ]},
    { id: "q_noise", question: "When does the grinding/squealing occur?", options: [
      { text: "Every brake application", faultCode: "C0031" },
      { text: "Only at very slow speed (parking lot)", faultCode: "C1210" },
      { text: "Only when ABS kicks in", faultCode: "C0110" },
      { text: "Constant — even without pressing pedal", faultCode: "C0040" },
    ]},
  ],
  electrical: [
    { id: "q1", question: "What electrical symptom is observed?", options: [
      { text: "Multiple warning lights illuminated simultaneously", faultCode: "U0100" },
      { text: "Battery drains overnight / dead in morning", faultCode: "P0562" },
      { text: "No connection when plugging in scan tool", faultCode: "B1000" },
      { text: "Instrument cluster flickering or blank", faultCode: "U0155" },
    ]},
  ],
  transmission: [
    { id: "q1", question: "What transmission symptom is present?", options: [
      { text: "Slipping between gears / RPM flares", faultCode: "P0730" },
      { text: "Stuck in one gear (limp mode)", faultCode: "P0760" },
      { text: "Shudder or vibration at highway speed", faultCode: "P0741" },
      { text: "Trans warning light only — shifts OK", faultCode: "P0700" },
    ]},
  ],
  suspension: [
    { id: "q1", question: "What steering/suspension issue is present?", options: [
      { text: "Steering pulls to left or right while driving", faultCode: "C0455" },
      { text: "Steering wheel is off-center after alignment", faultCode: "C0710" },
      { text: "Rear end feels loose or unstable", faultCode: "C1230" },
      { text: "Rear wheel speed sensor light on", faultCode: "C1230" },
    ]},
  ],
  cooling: [
    { id: "q1", question: "What cooling system issue is reported?", options: [
      { text: "Engine overheating / temp gauge in red", faultCode: "P0216" },
      { text: "Temperature gauge bouncing erratically", faultCode: "P0115" },
      { text: "Engine takes too long to reach operating temp", faultCode: "P0128" },
      { text: "Coolant loss with no visible external leak", faultCode: "P0216" },
    ]},
  ],
  exhaust: [
    { id: "q1", question: "What exhaust or emissions issue is present?", options: [
      { text: "CEL on — failed state emissions inspection", faultCode: "P0420" },
      { text: "DPF warning light (diesel vehicle)", faultCode: "P2002" },
      { text: "DPF pressure sensor fault code stored", faultCode: "P2452" },
      { text: "Catalyst efficiency fault on both banks", faultCode: "P0430" },
    ]},
  ],
  diesel_turbo: [
    { id: "q1", question: "What diesel/turbo symptom is present?", options: [
      { text: "Black smoke from exhaust + power loss", faultCode: "P0046" },
      { text: "Hard start in cold weather / glow plug issue", faultCode: "P0670" },
      { text: "White/gray smoke + excessive fuel smell", faultCode: "P003A" },
      { text: "Low power / fuel pressure warning on dash", faultCode: "P0087" },
    ]},
  ],
  air_brakes: [
    { id: "q1", question: "What air brake issue is reported?", options: [
      { text: "Low air pressure warning buzzer active", faultCode: "SA03" },
      { text: "Brakes dragging / drums overheating", faultCode: "SA00" },
      { text: "Air pressure not building after startup", faultCode: "SA03" },
      { text: "Spring (park) brake won't release", faultCode: "SA02" },
    ]},
  ],
  hvac: [
    { id: "q1", question: "What HVAC issue is reported?", options: [
      { text: "Fan doesn't respond to speed selector", faultCode: "B1432" },
      { text: "Temperature reads incorrectly on display", faultCode: "B1414" },
      { text: "Blower motor completely inoperative", faultCode: "B1432" },
      { text: "No cold air despite compressor engaging", faultCode: "B1414" },
    ]},
  ],
  fuel: [
    { id: "q1", question: "What fuel system symptom is present?", options: [
      { text: "Fuel pressure warning / hard start", faultCode: "P0087" },
      { text: "Fuel pressure regulator fault stored", faultCode: "P0089" },
      { text: "Running rich — black smoke / fuel smell", faultCode: "P0172" },
      { text: "Rich running on bank 2 specifically", faultCode: "P0175" },
    ]},
  ],
  hv_battery: [
    { id: "q1", question: "What HV battery symptom is present?", options: [
      { text: "Reduced range / capacity degradation warning", faultCode: "P0A80" },
      { text: "HV isolation fault warning light", faultCode: "P0AA0" },
      { text: "Battery cell temperature warning active", faultCode: "P0C4F" },
      { text: "Drive motor performance fault", faultCode: "P0A0F" },
    ]},
  ],
  inverter: [
    { id: "q1", question: "What inverter/motor controller symptom?", options: [
      { text: "Reduced power output / limp mode", faultCode: "P0D3B" },
      { text: "Inverter cooling system warning", faultCode: "P0A93" },
      { text: "Battery energy management fault", faultCode: "P0A1F" },
      { text: "Complete drive motor failure / no propulsion", faultCode: "P0D3B" },
    ]},
  ],
  charging: [
    { id: "q1", question: "What charging issue is reported?", options: [
      { text: "Won't charge on Level 2 / DCFC", faultCode: "P0AA6" },
      { text: "Battery management system fault", faultCode: "P0A80" },
      { text: "Charging rate significantly reduced", faultCode: "P0AA0" },
      { text: "BMS warning light on with no clear cause", faultCode: "P0A80" },
    ]},
  ],
  thermal: [
    { id: "q1", question: "What thermal management symptom?", options: [
      { text: "Battery temperature warning active", faultCode: "P0C4F" },
      { text: "Inverter overheating warning", faultCode: "P0A93" },
      { text: "Performance reduced in cold temperatures", faultCode: "P0A80" },
      { text: "Coolant fan not running at full speed", faultCode: "P0A9B" },
    ]},
  ],
};

// ── Repair phases ─────────────────────────────────────────────────────────────

type RepairPhase = "diagnose" | "disassemble" | "inspect" | "replace" | "reassemble" | "clear";

const PHASE_LABELS: Record<RepairPhase, string> = {
  diagnose:    "1. Diagnose",
  disassemble: "2. Disassemble",
  inspect:     "3. Inspect",
  replace:     "4. Replace Part",
  reassemble:  "5. Reassemble",
  clear:       "6. Clear & Recalibrate",
};

const PHASE_ORDER: RepairPhase[] = ["diagnose", "disassemble", "inspect", "replace", "reassemble", "clear"];

// ── Severity helpers ──────────────────────────────────────────────────────────

function severityColor(s: DTCRecord["severity"]) {
  return s === "critical" ? "text-red-400 border-red-500/50 bg-red-500/10"
    : s === "high"     ? "text-orange-400 border-orange-500/50 bg-orange-500/10"
    : s === "medium"   ? "text-yellow-400 border-yellow-500/50 bg-yellow-500/10"
    :                    "text-green-400 border-green-500/50 bg-green-500/10";
}

function severityLabel(s: DTCRecord["severity"]) {
  return s === "critical" ? "CRITICAL" : s === "high" ? "HIGH" : s === "medium" ? "MED" : "LOW";
}

// ── Main component ─────────────────────────────────────────────────────────────

export function VehicleDiagnosticsSimulation({ simulationId }: Props) {
  const { user }                          = useAuth();
  const { playSound }                     = useGameAudio();
  const { announce, announceUrgent }      = useScreenReader();
  const { savedProgress }                 = useSimulationProgress(simulationId);
  const { balance, spendVX }             = useVXWallet();
  const { isOnTrial }                     = useTrial();
  const { earnPoints }                    = useEarnPoints();

  // ── Vehicle selection ──────────────────────────────────────────────────────
  const [category, setCategory]   = useState("");
  const [make,     setMake]       = useState("");
  const [year,     setYear]       = useState("");
  const [model,    setModel]      = useState("");
  const [system,   setSystem]     = useState("");

  const vehicleReady = !!(category && make && year && model && system);
  const systems      = (category && make) ? getSystemsForVehicle(category, make) : [];
  const makes        = MANUFACTURERS[category] ?? [];
  const modelList    = MODELS[make] ?? [];

  // ── Diagnostics state ──────────────────────────────────────────────────────
  const [diagMode,        setDiagMode]        = useState<"A" | "B">("A");
  const [aiInput,         setAiInput]         = useState("");
  const [aiProcessing,    setAiProcessing]    = useState(false);
  const [aiResult,        setAiResult]        = useState<ParseResult | null>(null);
  const [questionId,      setQuestionId]      = useState<string>("q1");
  const [questionHistory, setQuestionHistory] = useState<string[]>([]);
  const [detectedFault,   setDetectedFault]   = useState<string | null>(null);

  // ── Scanner state ──────────────────────────────────────────────────────────
  const [scanning,        setScanning]        = useState(false);
  const [scanProgress,    setScanProgress]    = useState(0);
  const [scanStage,       setScanStage]       = useState("");
  const [scanComplete,    setScanComplete]    = useState(false);
  const [activeDTCs,      setActiveDTCs]      = useState<DTCRecord[]>([]);
  const [pendingDTCs,     setPendingDTCs]     = useState<DTCRecord[]>([]);

  // ── Repair state ───────────────────────────────────────────────────────────
  const [repairPhase,     setRepairPhase]     = useState<RepairPhase>("diagnose");
  const [selectedTools,   setSelectedTools]   = useState<Set<string>>(new Set());
  const [repairProgress,  setRepairProgress]  = useState(0);
  const [repairRunning,   setRepairRunning]   = useState(false);
  const [repairPhaseIdx,  setRepairPhaseIdx]  = useState(0);
  const [codeCleared,     setCodeCleared]     = useState(false);

  // ── Game state ─────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState("vehicle");
  const [score,           setScore]           = useState(0);
  const [totalVxEarned,   setTotalVxEarned]   = useState(0);
  const [jobsCompleted,   setJobsCompleted]   = useState(0);
  const [wrongGuesses,    setWrongGuesses]    = useState(0);
  const [finished,        setFinished]        = useState(false);
  const [sessionActive,   setSessionActive]   = useState(false);

  const [repairHistory, setRepairHistory] = useState<
    { vehicle: string; system: string; code: string; vx: number; success: boolean }[]
  >([]);

  // ── Restore saved progress ─────────────────────────────────────────────────
  useEffect(() => {
    if (!savedProgress) return;
    setScore(savedProgress.score ?? 0);
    setFinished(savedProgress.completed ?? false);
    setJobsCompleted((savedProgress.decisions as Record<string, number>)?.jobs ?? 0);
  }, [savedProgress]);

  const saveProgress = useCallback(
    async (sc: number, done: boolean) => {
      if (!user || !simulationId) return;
      await saveSimulationProgress(user.id, simulationId, {
        current_step: jobsCompleted,
        score: sc,
        completed: done,
        decisions: { jobs: jobsCompleted, wrongGuesses, history: repairHistory } as Record<string, unknown>,
      });
    },
    [user, simulationId, jobsCompleted, wrongGuesses, repairHistory]
  );

  // ── Session start ──────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    const paid = await spendVX(200, "simulation-entry", "Vehicle Diagnostics Simulator");
    if (!paid) return;
    setSessionActive(true);
    setActiveTab("vehicle");
    playSound("scan");
    toast.success(isOnTrial ? "Workshop Session Started — free during your trial" : "🔑 Workshop Session Started — 200 VX deducted");
    announce("Vehicle diagnostics simulator session started.");
  }, [spendVX, playSound, announce, isOnTrial]);

  // ── Vehicle confirm ────────────────────────────────────────────────────────
  const confirmVehicle = () => {
    if (!vehicleReady) return;
    setDetectedFault(null);
    setAiResult(null);
    setAiInput("");
    setQuestionId("q1");
    setQuestionHistory([]);
    setScanComplete(false);
    setActiveDTCs([]);
    setPendingDTCs([]);
    setRepairPhase("diagnose");
    setRepairPhaseIdx(0);
    setSelectedTools(new Set());
    setRepairProgress(0);
    setCodeCleared(false);
    setActiveTab("diagnostics");
    playSound("select");
    announce(`Vehicle configured: ${year} ${make} ${model}. Proceed to diagnostics.`);
    toast.success(`✅ Vehicle loaded: ${year} ${make} ${model}`);
  };

  // ── Mode A: AI symptom parsing ─────────────────────────────────────────────
  const runAIDiagnostics = useCallback(async () => {
    if (!aiInput.trim() || !system) return;
    setAiProcessing(true);
    setAiResult(null);
    playSound("scan");

    await new Promise(r => setTimeout(r, 2200));

    const result = parseSymptomToFault(aiInput, system);
    setAiResult(result);
    setAiProcessing(false);

    if (result.confidence >= 50) {
      playSound("ding");
      toast.success(`🤖 AI identified fault → ${result.dtcCode} (${result.confidence}% confidence)`);
    } else {
      toast(`⚠️ Low confidence result — consider Mode B or physical scan`);
    }
  }, [aiInput, system, playSound]);

  const confirmAIDiagnosis = () => {
    if (!aiResult) return;
    setDetectedFault(aiResult.dtcCode);
    buildScanResults(aiResult.dtcCode);
    setActiveTab("scanner");
    playSound("select");
  };

  // ── Mode B: question tree ──────────────────────────────────────────────────
  const currentTree  = QUESTION_TREES[system] ?? [];
  const currentNode  = currentTree.find(n => n.id === questionId);

  const answerQuestion = (option: QuestionNode["options"][0]) => {
    playSound("select");
    if (option.faultCode) {
      setDetectedFault(option.faultCode);
      buildScanResults(option.faultCode);
      setActiveTab("scanner");
      toast.success(`🔍 Fault isolated → ${option.faultCode}`);
      return;
    }
    if (option.nextId) {
      setQuestionHistory(h => [...h, questionId]);
      setQuestionId(option.nextId);
    }
  };

  const backQuestion = () => {
    if (!questionHistory.length) return;
    const prev = questionHistory[questionHistory.length - 1];
    setQuestionId(prev);
    setQuestionHistory(h => h.slice(0, -1));
  };

  // ── Build scan results from detected fault ─────────────────────────────────
  const buildScanResults = (primaryCode: string) => {
    const primary = DTC_BY_CODE[primaryCode];
    if (!primary) return;
    const active: DTCRecord[] = [primary];
    const pending: DTCRecord[] = [];

    // Add a related pending DTC based on system
    const systemDTCs = getDTCsForSystem(system).filter(d => d.code !== primaryCode);
    if (systemDTCs.length > 0) {
      const relatedIdx = Math.floor(Math.random() * Math.min(3, systemDTCs.length));
      pending.push(systemDTCs[relatedIdx]);
    }

    setActiveDTCs(active);
    setPendingDTCs(pending);
  };

  // ── OBD Scanner: run scan ──────────────────────────────────────────────────
  const runScan = useCallback(() => {
    if (scanning || !detectedFault) return;
    setScanning(true);
    setScanProgress(0);
    setScanComplete(false);
    playSound("scan");
    announce("Running OBD-II system scan.");

    const stages = [
      "Initializing CAN bus communication…",
      "Establishing link with ECM/PCM…",
      `Scanning ${system.replace("_", " ").toUpperCase()} module…`,
      "Reading freeze frame data…",
      "Fetching active & pending DTCs…",
      "Extracting sensor live data…",
      "Scan complete.",
    ];
    let step = 0;
    const total = 28;
    const iv = setInterval(() => {
      step++;
      setScanProgress(Math.round((step / total) * 100));
      const stageIdx = Math.min(Math.floor((step / total) * stages.length), stages.length - 1);
      setScanStage(stages[stageIdx]);
      if (step >= total) {
        clearInterval(iv);
        setScanning(false);
        setScanComplete(true);
        playSound("correct");
        announce(`Scan complete. ${activeDTCs.length} active DTC found.`);
        toast.success("📟 Scan Complete — DTCs retrieved from vehicle ECU");
      }
    }, 120);
  }, [scanning, detectedFault, system, playSound, announce, activeDTCs.length]);

  const proceedToGarage = () => {
    setActiveTab("garage");
    playSound("select");
  };

  // ── Repair Garage: tool toggle ─────────────────────────────────────────────
  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
    playSound("select");
  };

  // ── Repair Garage: execute phase ───────────────────────────────────────────
  const executePhase = useCallback(() => {
    if (repairRunning || !detectedFault) return;
    const proc = getRepairProcedure(detectedFault);

    if (repairPhase === "diagnose") {
      const requiredTools = proc.tools;
      const hasRequired   = requiredTools.some(t => selectedTools.has(t));
      if (!hasRequired && requiredTools.length > 0) {
        toast.error("⚠️ Select at least one appropriate diagnostic tool first.");
        announceUrgent("Select a diagnostic tool to proceed.");
        setWrongGuesses(w => w + 1);
        return;
      }
    }

    setRepairRunning(true);
    setRepairProgress(0);
    playSound("scan");
    let step = 0;
    const total = 16;
    const iv = setInterval(() => {
      step++;
      setRepairProgress(Math.round((step / total) * 100));
      if (step >= total) {
        clearInterval(iv);
        setRepairRunning(false);
        setRepairProgress(100);
        const nextIdx = repairPhaseIdx + 1;
        if (nextIdx < PHASE_ORDER.length) {
          setRepairPhaseIdx(nextIdx);
          setRepairPhase(PHASE_ORDER[nextIdx]);
          playSound("ding");
          toast.success(`✅ ${PHASE_LABELS[repairPhase]} complete`);
        }
      }
    }, 100);
  }, [repairRunning, detectedFault, repairPhase, repairPhaseIdx, selectedTools, playSound, announceUrgent]);

  // ── Repair Garage: clear codes & finalize ─────────────────────────────────
  const clearAndFinalize = useCallback(async () => {
    if (repairPhase !== "clear" || codeCleared) return;
    setRepairRunning(true);
    playSound("scan");
    await new Promise(r => setTimeout(r, 1800));

    setCodeCleared(true);
    setRepairRunning(false);
    setActiveDTCs([]);
    setPendingDTCs([]);

    const proc     = getRepairProcedure(detectedFault!);
    const penalty  = wrongGuesses * 200;
    const vxEarned = Math.max(200, proc.vxReward - penalty);
    const pts      = Math.round(vxEarned / 10);

    await earnPoints(vxEarned, `vehicle-diagnostics:repair:${detectedFault}`);
    setTotalVxEarned(v => v + vxEarned);
    setScore(s => s + pts);
    setJobsCompleted(j => j + 1);

    const entry = {
      vehicle: `${year} ${make} ${model}`,
      system,
      code:    detectedFault!,
      vx:      vxEarned,
      success: true,
    };
    setRepairHistory(h => [...h, entry]);

    playSound("complete");
    announceUrgent("Repair complete! DTCs cleared and system recalibrated.");
    toast.success(`🏆 Repair Complete! +${vxEarned.toLocaleString()} VX earned`);
    await saveProgress(score + pts, false);
  }, [
    repairPhase, codeCleared, detectedFault, wrongGuesses,
    earnPoints, year, make, model, system, playSound, announceUrgent, score, saveProgress,
  ]);

  // ── New job ────────────────────────────────────────────────────────────────
  const startNewJob = () => {
    setCategory("");
    setMake("");
    setYear("");
    setModel("");
    setSystem("");
    setDetectedFault(null);
    setAiResult(null);
    setAiInput("");
    setQuestionId("q1");
    setQuestionHistory([]);
    setScanComplete(false);
    setActiveDTCs([]);
    setPendingDTCs([]);
    setRepairPhase("diagnose");
    setRepairPhaseIdx(0);
    setSelectedTools(new Set());
    setRepairProgress(0);
    setRepairRunning(false);
    setCodeCleared(false);
    setWrongGuesses(0);
    setActiveTab("vehicle");
    playSound("select");
  };

  // ── Finish session ─────────────────────────────────────────────────────────
  const finishSession = useCallback(async () => {
    setFinished(true);
    playSound("complete");
    announce("Session complete! Final report ready.");
    await saveProgress(score, true);
  }, [playSound, announce, score, saveProgress]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const proc = detectedFault ? getRepairProcedure(detectedFault) : null;

  // ── Completed screen ───────────────────────────────────────────────────────
  if (finished) {
    const accuracy = repairHistory.length > 0
      ? Math.round((repairHistory.filter(h => h.success).length / repairHistory.length) * 100)
      : 0;
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in space-y-4">
        <Card className="border-green-500/30" style={{ background: "hsl(220,20%,7%)" }}>
          <CardContent className="p-8 text-center space-y-6">
            <Trophy className="mx-auto h-16 w-16 text-yellow-400" />
            <h2 className="text-2xl font-bold text-green-400">DIAGNOSTIC SESSION COMPLETE</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                <p className="text-3xl font-bold font-mono text-green-400">{jobsCompleted}</p>
                <p className="text-xs text-slate-400 mt-1">Jobs Completed</p>
              </div>
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
                <p className="text-3xl font-bold font-mono text-cyan-400">{totalVxEarned.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">VX Earned</p>
              </div>
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <p className="text-3xl font-bold font-mono text-yellow-400">{accuracy}%</p>
                <p className="text-xs text-slate-400 mt-1">Accuracy Rate</p>
              </div>
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                <p className="text-3xl font-bold font-mono text-purple-400">{score}</p>
                <p className="text-xs text-slate-400 mt-1">Total Score</p>
              </div>
            </div>
            {repairHistory.length > 0 && (
              <div className="space-y-2 text-left">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Repair Log</p>
                {repairHistory.map((h, i) => (
                  <div key={i} className="flex justify-between items-center text-xs p-2 rounded-md border border-slate-700/50 bg-slate-800/40 font-mono">
                    <span className="text-slate-300">{h.vehicle} / {h.system.replace("_"," ")}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-red-400 border-red-500/40 text-[10px]">{h.code}</Badge>
                      <span className="text-green-400">+{h.vx.toLocaleString()} VX</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => { setFinished(false); startNewJob(); }} className="w-full bg-green-600 hover:bg-green-500 text-black font-bold">
              <RotateCcw className="mr-2 h-4 w-4" /> Start New Session
            </Button>
          </CardContent>
        </Card>
        <SimulationMentor simulationTitle="Vehicle Diagnostics & Repair Simulator" currentStepTitle="Results" />
      </div>
    );
  }

  // ── Session gate ───────────────────────────────────────────────────────────
  if (!sessionActive) {
    return (
      <div className="max-w-xl mx-auto space-y-4 animate-in fade-in">
        <SimulationScene slug="vehicle-diagnostics" isActive={false} isComplete={false} />
        <Card className="border-green-500/30" style={{ background: "hsl(220,20%,7%)" }}>
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <Activity className="h-5 w-5" /> VISIONEX DIAGNOSTIC SYSTEM v4.2
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { icon: "🚗", label: "Multi-Vehicle Support",  desc: "Cars, Trucks, Buses, Motorcycles" },
                { icon: "📟", label: "OBD-II / J1939 Scanner", desc: "Active & Pending DTC Retrieval" },
                { icon: "🤖", label: "AI Diagnostics Mode",    desc: "Natural Language Symptom Parsing" },
                { icon: "🔧", label: "Virtual Repair Garage",  desc: "Step-by-Step Guided Workflow" },
              ].map(f => (
                <div key={f.label} className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 space-y-1">
                  <p className="text-base">{f.icon}</p>
                  <p className="font-semibold text-slate-200 text-xs">{f.label}</p>
                  <p className="text-slate-500 text-[10px]">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
              <div>
                <p className="text-xs text-slate-400">Session Entry Fee</p>
                <p className="text-lg font-bold font-mono text-cyan-400">200 VX</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Your Balance</p>
                <p className="text-lg font-bold font-mono text-slate-200">{balance.toLocaleString()} VX</p>
              </div>
            </div>
            <Button
              onClick={startSession}
              disabled={balance < 200}
              className="w-full bg-green-600 hover:bg-green-500 text-black font-bold h-12"
              aria-label="Start diagnostic session — 200 VX"
            >
              <Zap className="mr-2 h-5 w-5" /> START DIAGNOSTIC SESSION
            </Button>
            {balance < 200 && (
              <p className="text-center text-xs text-red-400">Insufficient VX balance. Visit the Bazaar to top up.</p>
            )}
          </CardContent>
        </Card>
        <SimulationMentor simulationTitle="Vehicle Diagnostics & Repair Simulator" currentStepTitle="Session Gate" />
      </div>
    );
  }

  // ── Main simulator UI ──────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-3 animate-in fade-in">
      <SimulationScene slug="vehicle-diagnostics" isActive={true} isComplete={codeCleared} />

      {/* ── Header status bar ── */}
      <div
        className="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"
        style={{ background: "hsl(220,20%,5%)", borderColor: "rgba(34,197,94,0.2)" }}
      >
        <div className="flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-mono font-bold tracking-widest">VISIONEX DIAG v4.2</span>
        </div>
        {vehicleReady && (
          <Badge variant="outline" className="font-mono text-cyan-400 border-cyan-500/40 text-[11px]">
            {year} {make} {model}
          </Badge>
        )}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase">Score</p>
            <p className="text-sm font-mono font-bold text-yellow-400">{score.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase">VX Balance</p>
            <p className="text-sm font-mono font-bold text-cyan-400">{balance.toLocaleString()}</p>
          </div>
          {jobsCompleted >= 3 && (
            <Button size="sm" variant="outline" onClick={finishSession} className="text-xs h-7 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10">
              Finish Session
            </Button>
          )}
        </div>
      </div>

      {/* ── Main tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 h-10" style={{ background: "hsl(220,20%,8%)" }}>
          {[
            { value: "vehicle",     icon: <Car className="h-3.5 w-3.5" />,      label: "Vehicle"     },
            { value: "diagnostics", icon: <Search className="h-3.5 w-3.5" />,   label: "Diagnostics" },
            { value: "scanner",     icon: <Activity className="h-3.5 w-3.5" />, label: "OBD Scanner" },
            { value: "garage",      icon: <Wrench className="h-3.5 w-3.5" />,   label: "Garage"      },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex items-center gap-1 text-xs data-[state=active]:text-green-400 data-[state=active]:bg-green-500/10"
            >
              {tab.icon}{tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ════════════════════════════════════════════════════════════
            TAB 1 — VEHICLE SELECTION
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="vehicle" className="space-y-3 mt-3">
          <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <Car className="h-4 w-4 text-cyan-400" /> VEHICLE SELECTION MATRIX
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Category */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Vehicle Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setCategory(cat.id); setMake(""); setModel(""); setSystem(""); }}
                      aria-label={`Category: ${cat.label}`}
                      className={cn(
                        "p-2.5 rounded-lg border text-center transition-all text-xs font-medium",
                        category === cat.id
                          ? "border-green-500/60 bg-green-500/15 text-green-400"
                          : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      <div className="text-lg mb-0.5">{cat.icon}</div>
                      <div className="leading-tight">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manufacturer */}
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Manufacturer</label>
                <Select value={make} onValueChange={v => { setMake(v); setModel(""); setSystem(""); }} disabled={!category}>
                  <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-200">
                    <SelectValue placeholder="Select manufacturer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Year + Model */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Model Year</label>
                  <Select value={year} onValueChange={setYear} disabled={!make}>
                    <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-200">
                      <SelectValue placeholder="Year…" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">Model</label>
                  <Select value={model} onValueChange={setModel} disabled={!make}>
                    <SelectTrigger className="bg-slate-800/60 border-slate-700/50 text-slate-200">
                      <SelectValue placeholder="Model…" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelList.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* System */}
              {make && year && model && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1.5">
                    Diagnostic System
                    {EV_MAKES.has(make) && <span className="ml-2 text-green-400">⚡ EV Systems Unlocked</span>}
                    {HEAVY_TRUCK_MAKES.has(make) && <span className="ml-2 text-orange-400">🚛 Heavy Truck Systems</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {systems.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSystem(s.id)}
                        aria-label={`System: ${s.name}`}
                        className={cn(
                          "p-2.5 rounded-lg border text-left text-xs transition-all",
                          system === s.id
                            ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300"
                            : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600"
                        )}
                      >
                        <span className="mr-1.5">{s.icon}</span>{s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={confirmVehicle}
                disabled={!vehicleReady}
                className="w-full bg-green-600 hover:bg-green-500 text-black font-bold h-11"
                aria-label="Confirm vehicle and proceed to diagnostics"
              >
                <ChevronRight className="mr-2 h-4 w-4" /> CONFIRM VEHICLE → DIAGNOSTICS
              </Button>
            </CardContent>
          </Card>

          {jobsCompleted > 0 && (
            <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
              <CardContent className="p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Repair History</p>
                {repairHistory.map((h, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 border-b border-slate-700/30 last:border-0 font-mono">
                    <span className="text-slate-300">{h.vehicle}</span>
                    <span className="text-red-400">{h.code}</span>
                    <span className="text-green-400">+{h.vx.toLocaleString()} VX</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════
            TAB 2 — DIAGNOSTICS ENGINE
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="diagnostics" className="space-y-3 mt-3">
          {!vehicleReady ? (
            <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
              <CardContent className="p-8 text-center text-slate-500">
                <Search className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Configure a vehicle first on the Vehicle tab.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-3">
                {(["A", "B"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setDiagMode(mode); setAiResult(null); setDetectedFault(null); setQuestionId("q1"); setQuestionHistory([]); }}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      diagMode === mode
                        ? "border-green-500/60 bg-green-500/10"
                        : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600"
                    )}
                  >
                    <p className={cn("text-sm font-bold mb-1", diagMode === mode ? "text-green-400" : "text-slate-300")}>
                      {mode === "A" ? "🤖 Mode A" : "🌿 Mode B"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {mode === "A" ? "AI Assistant — describe symptoms in plain text" : "Expert Question Tree — guided fault isolation"}
                    </p>
                  </button>
                ))}
              </div>

              {/* Mode A */}
              {diagMode === "A" && (
                <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-green-400" /> AI SYMPTOM PARSER
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-[11px] text-slate-500">Describe the vehicle problem in your own words — any language or slang is accepted.</p>
                    <Textarea
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      placeholder={`e.g. "My ${make} ${model} is shaking really bad at idle and the check engine light is flashing…"`}
                      className="bg-slate-800/60 border-slate-700/50 text-slate-200 resize-none h-28 text-sm font-mono placeholder:text-slate-600"
                      aria-label="Describe vehicle symptoms"
                    />
                    <Button
                      onClick={runAIDiagnostics}
                      disabled={!aiInput.trim() || aiProcessing}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-bold"
                      aria-label="Run AI diagnostics"
                    >
                      {aiProcessing ? (
                        <><Cpu className="mr-2 h-4 w-4 animate-pulse" /> Analyzing Symptoms…</>
                      ) : (
                        <><Search className="mr-2 h-4 w-4" /> ANALYZE WITH AI</>
                      )}
                    </Button>

                    {aiProcessing && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-cyan-400">
                          <Cpu className="h-3.5 w-3.5 animate-spin" />
                          <span className="font-mono">Cross-referencing symptom patterns against DTC database…</span>
                        </div>
                        <Progress value={undefined} className="h-1.5 animate-pulse" />
                      </div>
                    )}

                    {aiResult && !aiProcessing && (
                      <div className={cn(
                        "p-4 rounded-lg border space-y-3",
                        aiResult.confidence >= 70 ? "border-green-500/30 bg-green-500/5" : "border-yellow-500/30 bg-yellow-500/5"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-widest text-slate-500">AI Diagnostic Result</span>
                          <Badge variant="outline" className={cn(
                            "font-mono text-xs",
                            aiResult.confidence >= 70 ? "text-green-400 border-green-500/40" : "text-yellow-400 border-yellow-500/40"
                          )}>
                            {aiResult.confidence}% confidence
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-mono font-bold text-red-400">{aiResult.dtcCode}</span>
                          <span className="text-xs text-slate-300">{DTC_BY_CODE[aiResult.dtcCode]?.description}</span>
                        </div>
                        <p className="text-xs text-slate-400 italic">"{aiResult.reasoning}"</p>
                        <Button onClick={confirmAIDiagnosis} className="w-full bg-green-600 hover:bg-green-500 text-black font-bold text-sm">
                          <ChevronRight className="mr-2 h-4 w-4" /> CONFIRM → RUN OBD SCAN
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Mode B */}
              {diagMode === "B" && (
                <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-400" /> GUIDED FAULT ISOLATION
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!currentTree.length ? (
                      <p className="text-sm text-slate-500 text-center">No question tree available for this system. Use Mode A.</p>
                    ) : currentNode ? (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                          <p className="text-xs text-slate-500 font-mono">{system.replace("_", " ").toUpperCase()} — FAULT ISOLATION</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-200">{currentNode.question}</p>
                        <div className="space-y-2">
                          {currentNode.options.map((opt, i) => (
                            <button
                              key={i}
                              onClick={() => answerQuestion(opt)}
                              className="w-full text-left p-3 rounded-lg border border-slate-700/50 bg-slate-800/40 text-sm text-slate-300 hover:border-green-500/40 hover:bg-green-500/5 hover:text-green-300 transition-all flex items-center gap-2"
                              aria-label={opt.text}
                            >
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                              {opt.text}
                            </button>
                          ))}
                        </div>
                        {questionHistory.length > 0 && (
                          <Button size="sm" variant="ghost" onClick={backQuestion} className="text-slate-500 text-xs">
                            ← Back
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 text-center">Question tree navigation error. Please restart.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════
            TAB 3 — VIRTUAL OBD SCANNER
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="scanner" className="space-y-3 mt-3">
          {!detectedFault ? (
            <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
              <CardContent className="p-8 text-center text-slate-500">
                <Activity className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Complete diagnostics to enable the scanner.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Scanner panel */}
              <Card
                className="border-green-500/20"
                style={{ background: "linear-gradient(135deg, hsl(220,20%,6%) 0%, hsl(140,30%,6%) 100%)" }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm text-green-400 font-mono flex items-center gap-2">
                      <Activity className="h-4 w-4" /> VISIONEX OBD-II PRO SCANNER
                    </CardTitle>
                    <div className="flex gap-1">
                      {["red", "yellow", "green"].map(c => (
                        <div key={c} className={cn("h-2.5 w-2.5 rounded-full", {
                          "bg-red-500": c === "red",
                          "bg-yellow-500 animate-pulse": c === "yellow" && !scanComplete,
                          "bg-yellow-500 opacity-30": c === "yellow" && scanComplete,
                          "bg-green-500 animate-pulse": c === "green" && scanComplete,
                          "bg-green-500 opacity-30": c === "green" && !scanComplete,
                        })} />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Connection info */}
                  <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                    {[
                      { label: "PROTOCOL", value: (category === "truck" || category === "bus") ? "SAE J1939" : "ISO 15765-4" },
                      { label: "INTERFACE", value: (category === "truck" || category === "bus") ? "HD-OBD" : "OBD-II" },
                      { label: "VEHICLE",   value: `${year} ${make}` },
                    ].map(item => (
                      <div key={item.label} className="p-2 rounded border border-green-500/20 bg-black/30">
                        <p className="text-slate-500">{item.label}</p>
                        <p className="text-green-400 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Scan progress */}
                  {scanning && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                        <span className="text-green-400 text-xs font-mono">{scanStage}</span>
                      </div>
                      <Progress value={scanProgress} className="h-2 bg-slate-800 [&>div]:bg-green-500" />
                      <p className="text-right text-[10px] font-mono text-green-500">{scanProgress}%</p>
                    </div>
                  )}

                  {!scanning && !scanComplete && (
                    <Button
                      onClick={runScan}
                      className="w-full h-12 bg-green-600 hover:bg-green-500 text-black font-bold text-sm font-mono"
                      aria-label="Run OBD system scan"
                    >
                      <Activity className="mr-2 h-5 w-5" /> RUN SYSTEM SCAN
                    </Button>
                  )}

                  {/* DTC Results */}
                  {scanComplete && (
                    <div className="space-y-3">
                      {activeDTCs.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                            Active DTCs ({activeDTCs.length})
                          </p>
                          {activeDTCs.map(dtc => (
                            <div
                              key={dtc.code}
                              className={cn("p-3 rounded-lg border mb-2 font-mono", severityColor(dtc.severity))}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-base font-bold">{dtc.code}</span>
                                <Badge variant="outline" className={cn("text-[9px]", severityColor(dtc.severity))}>
                                  {severityLabel(dtc.severity)}
                                </Badge>
                              </div>
                              <p className="text-[11px] opacity-80">{dtc.description}</p>
                              <p className="text-[10px] opacity-50 mt-0.5">System: {dtc.system.replace("_", " ").toUpperCase()}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {pendingDTCs.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            Pending DTCs ({pendingDTCs.length})
                          </p>
                          {pendingDTCs.map(dtc => (
                            <div key={dtc.code} className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 font-mono mb-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-bold text-yellow-400">{dtc.code}</span>
                                <Badge variant="outline" className="text-[9px] text-yellow-400 border-yellow-500/40">PENDING</Badge>
                              </div>
                              <p className="text-[11px] text-yellow-300/70">{dtc.description}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {activeDTCs.length === 0 && pendingDTCs.length === 0 && (
                        <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/5 text-center font-mono">
                          <CheckCircle2 className="mx-auto h-6 w-6 text-green-400 mb-1" />
                          <p className="text-green-400 text-sm">NO FAULTS DETECTED</p>
                          <p className="text-slate-500 text-xs">All systems nominal</p>
                        </div>
                      )}

                      <Button
                        onClick={proceedToGarage}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-bold"
                        aria-label="Proceed to repair garage"
                      >
                        <Wrench className="mr-2 h-4 w-4" /> PROCEED TO REPAIR GARAGE →
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════
            TAB 4 — REPAIR GARAGE
            ════════════════════════════════════════════════════════════ */}
        <TabsContent value="garage" className="space-y-3 mt-3">
          {!detectedFault || !scanComplete ? (
            <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
              <CardContent className="p-8 text-center text-slate-500">
                <Wrench className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Complete the OBD scan to access the repair garage.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Phase stepper */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                {PHASE_ORDER.map((phase, i) => (
                  <div key={phase} className="flex items-center gap-1 shrink-0">
                    <div className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      i < repairPhaseIdx ? "bg-green-500" :
                      i === repairPhaseIdx ? "bg-cyan-400 animate-pulse" :
                      "bg-slate-600"
                    )} />
                    <span className={cn(
                      "text-[9px] font-mono whitespace-nowrap",
                      i < repairPhaseIdx ? "text-green-500" :
                      i === repairPhaseIdx ? "text-cyan-400" :
                      "text-slate-600"
                    )}>
                      {PHASE_LABELS[phase].split(". ")[1].toUpperCase()}
                    </span>
                    {i < PHASE_ORDER.length - 1 && <div className={cn("h-px w-4 shrink-0", i < repairPhaseIdx ? "bg-green-500" : "bg-slate-700")} />}
                  </div>
                ))}
              </div>

              {/* Repair info card */}
              {proc && (
                <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-slate-300 font-mono">
                        REPAIR ORDER — {detectedFault}
                      </CardTitle>
                      <Badge variant="outline" className="font-mono text-cyan-400 border-cyan-500/40 text-[10px]">
                        {proc.timeMin} min est. · ${proc.estimatedCost.toLocaleString()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Current step */}
                    <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Phase</p>
                      <p className="text-cyan-400 font-semibold text-sm">{PHASE_LABELS[repairPhase]}</p>
                      {proc.steps[repairPhaseIdx] && (
                        <p className="text-slate-300 text-xs mt-1">{proc.steps[repairPhaseIdx]}</p>
                      )}
                    </div>

                    {/* Progress bar */}
                    {repairRunning && (
                      <div className="space-y-1">
                        <Progress value={repairProgress} className="h-2 bg-slate-800 [&>div]:bg-cyan-500" />
                        <p className="text-right text-[10px] font-mono text-cyan-500">{repairProgress}%</p>
                      </div>
                    )}

                    {/* Parts list */}
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Required Parts</p>
                      <div className="flex flex-wrap gap-1.5">
                        {proc.parts.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] text-slate-300 border-slate-600">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* All repair steps */}
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Repair Procedure</p>
                      <ol className="space-y-1.5">
                        {proc.steps.map((step, i) => (
                          <li key={i} className={cn(
                            "flex items-start gap-2 text-xs p-2 rounded",
                            i < repairPhaseIdx ? "text-green-400 bg-green-500/5" :
                            i === repairPhaseIdx ? "text-slate-200 bg-slate-800/60" :
                            "text-slate-600"
                          )}>
                            <span className="font-mono shrink-0">{i < repairPhaseIdx ? "✓" : `${i + 1}.`}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Toolbox */}
              <Card className="border-slate-700/50" style={{ background: "hsl(220,20%,8%)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-orange-400" /> TOOLBOX
                    <span className="text-[10px] text-slate-500 font-normal ml-1">— select tools required for this phase</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {TOOLBOX.map(tool => {
                      const isNeeded  = proc?.tools.includes(tool.id) ?? false;
                      const isActive  = selectedTools.has(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={() => toggleTool(tool.id)}
                          disabled={codeCleared}
                          aria-label={`${isActive ? "Deselect" : "Select"} ${tool.name}`}
                          className={cn(
                            "p-2.5 rounded-lg border text-left transition-all text-xs",
                            isActive
                              ? "border-orange-500/60 bg-orange-500/10 text-orange-300"
                              : isNeeded
                              ? "border-orange-500/20 bg-slate-800/40 text-slate-400 hover:border-orange-500/40"
                              : "border-slate-700/40 bg-slate-800/20 text-slate-600 hover:border-slate-600"
                          )}
                        >
                          <span className="text-base">{tool.icon}</span>
                          <p className="font-semibold mt-0.5 leading-tight">{tool.name}</p>
                          <p className="text-[10px] opacity-60 leading-tight">{tool.desc}</p>
                          {isNeeded && !isActive && (
                            <span className="text-[9px] text-orange-400 mt-0.5 block">Recommended ↑</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Action buttons */}
              {!codeCleared && (
                <div className="space-y-2">
                  {repairPhase !== "clear" ? (
                    <Button
                      onClick={executePhase}
                      disabled={repairRunning}
                      className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-black font-bold"
                      aria-label={`Execute ${PHASE_LABELS[repairPhase]}`}
                    >
                      {repairRunning ? (
                        <><Wrench className="mr-2 h-5 w-5 animate-spin" /> Working…</>
                      ) : (
                        <><Wrench className="mr-2 h-5 w-5" /> EXECUTE: {PHASE_LABELS[repairPhase].toUpperCase()}</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={clearAndFinalize}
                      disabled={repairRunning}
                      className="w-full h-12 bg-green-600 hover:bg-green-500 text-black font-bold"
                      aria-label="Clear DTCs and recalibrate system"
                    >
                      {repairRunning ? (
                        <><Activity className="mr-2 h-5 w-5 animate-pulse" /> Clearing Codes & Recalibrating…</>
                      ) : (
                        <><Shield className="mr-2 h-5 w-5" /> CLEAR DTCs & RECALIBRATE SYSTEM</>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Success: repair done */}
              {codeCleared && (
                <Card className="border-green-500/30" style={{ background: "hsl(140,30%,5%)" }}>
                  <CardContent className="p-6 text-center space-y-3">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
                    <p className="text-green-400 font-bold text-lg font-mono">REPAIR COMPLETE</p>
                    <p className="text-slate-400 text-sm">DTCs cleared — system recalibrated and verified</p>
                    <div className="flex justify-center gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold font-mono text-yellow-400">{repairHistory[repairHistory.length - 1]?.vx.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">VX Earned</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={startNewJob} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-black font-bold">
                        <Car className="mr-2 h-4 w-4" /> New Vehicle Job
                      </Button>
                      <Button onClick={finishSession} variant="outline" className="flex-1 border-green-500/40 text-green-400 hover:bg-green-500/10">
                        <Trophy className="mr-2 h-4 w-4" /> End Session
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <SimulationMentor
        simulationTitle="Ultimate Vehicle Diagnostics & Repair Simulator"
        currentStepTitle={vehicleReady ? `${year} ${make} ${model} — ${system.replace("_", " ")}` : "Vehicle Selection"}
      />
    </div>
  );
}
