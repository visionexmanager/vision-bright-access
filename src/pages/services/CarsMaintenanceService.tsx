import ServiceRequestPage from "./ServiceRequestPage";
import { Wrench, Clock, Shield, Gauge } from "lucide-react";
import heroImg from "@/assets/service-consulting.jpg";

const packages = [
  {
    name: "Quick Inspection",
    vx: 5_000,
    description: "A rapid online vehicle health assessment and maintenance advisory.",
    features: [
      "AI-powered symptom analysis",
      "Recommended maintenance checklist",
      "Estimated service costs report",
      "Priority issue identification",
      "1 follow-up question via chat",
    ],
  },
  {
    name: "Diagnostic Report",
    vx: 25_000,
    badge: "Most Popular",
    description: "Full remote diagnostic consultation with a certified automotive technician.",
    features: [
      "Live video walkthrough with technician",
      "OBD-II fault code interpretation",
      "Root cause analysis report",
      "Parts & labour cost estimate",
      "Repair priority roadmap",
      "48-hour written diagnostic summary",
    ],
  },
  {
    name: "Full Service Plan",
    vx: 75_000,
    description: "Complete maintenance consultation with 30 days of ongoing technical support.",
    features: [
      "Comprehensive vehicle system review",
      "DTC scanning & reset guidance",
      "Seasonal maintenance scheduling",
      "Parts sourcing recommendations",
      "Unlimited follow-up for 30 days",
      "Emergency diagnostic hotline access",
      "Final maintenance log & report",
    ],
  },
];

const highlights = [
  { icon: Gauge,  label: "Coverage",  value: "Cars, Trucks, Buses & Motorcycles" },
  { icon: Clock,  label: "Response",  value: "Within 24 hours"                   },
  { icon: Shield, label: "Backed by", value: "Certified automotive technicians"  },
];

export default function CarsMaintenanceService() {
  return (
    <ServiceRequestPage
      title="Cars Maintenance"
      subtitle="Expert automotive diagnostics, maintenance, and repair consultations for all vehicle types — online, fast, and professional."
      icon={Wrench}
      heroImage={heroImg}
      serviceType="Cars Maintenance"
      packages={packages}
      highlights={highlights}
    />
  );
}
