import ServiceRequestPage from "./ServiceRequestPage";
import { Scissors, Clock, Star, Shield } from "lucide-react";
import heroImg from "@/assets/sim-barber.jpg";

const packages = [
  {
    name: "Hair Consultation",
    vx: 40_000,
    description: "Expert analysis of your hair type, condition, and personalised care plan.",
    features: [
      "Hair & scalp diagnosis session (45 min)",
      "Customised hair care routine",
      "Product recommendations",
      "Diet & lifestyle tips for healthier hair",
      "Follow-up advice via message",
    ],
  },
  {
    name: "Treatment Package",
    vx: 150_000,
    badge: "Most Popular",
    description: "A complete treatment programme to restore shine, strength, and growth.",
    features: [
      "3 professional treatment sessions",
      "Deep conditioning & keratin mask",
      "Scalp therapy & massage",
      "Hair growth serum application",
      "Home care kit (shampoo + conditioner)",
      "Progress photos before & after",
    ],
  },
  {
    name: "Hair Transformation",
    vx: 350_000,
    description: "A full transformation journey — cut, colour, and long-term health plan.",
    features: [
      "6 professional sessions (2 months)",
      "Custom colour or balayage service",
      "Keratin smoothing treatment",
      "Premium monthly hair mask",
      "Dedicated stylist throughout",
      "Unlimited messaging support",
      "Final professional photo shoot",
    ],
  },
];

const highlights = [
  { icon: Scissors, label: "Specialists",    value: "Certified trichologists & stylists" },
  { icon: Clock,    label: "First Session",  value: "Within 48 hours of booking" },
  { icon: Star,     label: "Hair Types",     value: "All types — straight, curly, coily & more" },
  { icon: Shield,   label: "Products",       value: "100% sulphate-free & dermatologist-approved" },
];

export default function HairCare() {
  return (
    <ServiceRequestPage
      title="Hair Care Specialist"
      subtitle="Professional hair analysis, treatments, and transformation plans for every hair type."
      icon={Scissors}
      heroImage={heroImg}
      serviceType="Hair Care"
      packages={packages}
      highlights={highlights}
    />
  );
}
