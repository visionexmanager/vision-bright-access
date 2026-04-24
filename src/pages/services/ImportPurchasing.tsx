import ServiceRequestPage from "./ServiceRequestPage";
import { Package, Globe, ShieldCheck, FileCheck } from "lucide-react";
import heroImg from "@/assets/service-import.jpg";

const packages = [
  {
    name: "Sourcing Consultation",
    vx: 80_000,
    description: "Expert guidance to find the right suppliers for your product.",
    features: [
      "1-hour strategy call",
      "Top 5 vetted supplier recommendations",
      "Pricing & MOQ benchmarks",
      "Product specification template",
      "Written summary report",
    ],
  },
  {
    name: "Import Assistance",
    vx: 320_000,
    badge: "Most Popular",
    description: "Full support from supplier selection through customs clearance.",
    features: [
      "Supplier sourcing & vetting",
      "Price negotiation support",
      "Sample coordination",
      "Shipping & logistics planning",
      "Import documentation guide",
      "Quality inspection checklist",
    ],
  },
  {
    name: "Full Supply Chain",
    vx: 750_000,
    description: "End-to-end supply chain management for scaling businesses.",
    features: [
      "Multi-supplier management",
      "Ongoing procurement strategy",
      "Customs & duties optimization",
      "Warehouse & fulfillment planning",
      "Quarterly supply chain review",
      "Dedicated sourcing agent",
    ],
  },
];

const highlights = [
  { icon: Globe, label: "Sourcing Regions", value: "China, UAE, Turkey, EU" },
  { icon: ShieldCheck, label: "Supplier Vetting", value: "Background checked" },
  { icon: FileCheck, label: "Documentation", value: "Full import paperwork" },
];

export default function ImportPurchasing() {
  return (
    <ServiceRequestPage
      title="Import & Purchasing"
      subtitle="Connect with reliable global suppliers and navigate international trade with confidence."
      icon={Package}
      heroImage={heroImg}
      serviceType="Import & Purchasing"
      packages={packages}
      highlights={highlights}
    />
  );
}
