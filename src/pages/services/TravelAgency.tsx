import ServiceRequestPage from "./ServiceRequestPage";
import { Plane, Clock, Globe, Shield } from "lucide-react";
import heroImg from "@/assets/service-import.jpg";

const packages = [
  {
    name: "Trip Planning",
    vx: 80_000,
    description: "A tailored travel itinerary designed around your preferences and budget.",
    features: [
      "Destination research & recommendations",
      "Day-by-day itinerary (up to 10 days)",
      "Best flight route advice",
      "Hotel & accommodation shortlist",
      "Visa requirements & entry notes",
      "Packing & preparation checklist",
    ],
  },
  {
    name: "Full Travel Package",
    vx: 300_000,
    badge: "Most Popular",
    description: "Complete end-to-end travel management — flights, hotel, and activities.",
    features: [
      "Flight booking assistance & best-fare search",
      "Hotel booking (budget to luxury)",
      "Airport transfer coordination",
      "Local tours & activity booking",
      "Travel insurance guidance",
      "24/7 WhatsApp support during trip",
      "Emergency contact & backup plans",
    ],
  },
  {
    name: "Concierge Travel",
    vx: 700_000,
    description: "VIP travel experience with a dedicated travel concierge from start to finish.",
    features: [
      "Dedicated senior travel specialist",
      "Business or first-class flight arrangement",
      "5-star hotel selection & negotiation",
      "Private transfers & chauffeur service",
      "Exclusive restaurant & experience reservations",
      "Embassy appointment scheduling",
      "Full golden file: visa, insurance, itinerary, emergency contacts",
      "On-call support 24/7 throughout journey",
    ],
  },
];

const highlights = [
  { icon: Plane,   label: "Destinations",  value: "200+ countries covered" },
  { icon: Globe,   label: "Visas",         value: "Expert guidance for MENA, EU, USA & more" },
  { icon: Clock,   label: "Turnaround",    value: "Itinerary delivered in 48 hours" },
  { icon: Shield,  label: "Support",       value: "24/7 emergency travel assistance" },
];

export default function TravelAgency() {
  return (
    <ServiceRequestPage
      title="Travel Agency"
      subtitle="From the first thought of travel to your safe return — we handle every detail."
      icon={Plane}
      heroImage={heroImg}
      serviceType="Travel Agency"
      packages={packages}
      highlights={highlights}
    />
  );
}
