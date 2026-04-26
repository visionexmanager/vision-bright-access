import ServiceRequestPage from "./ServiceRequestPage";
import { Sparkles, Clock, Star, Shield } from "lucide-react";
import heroImg from "@/assets/sim-skincare.jpg";

const packages = [
  {
    name: "Skin Analysis",
    vx: 40_000,
    description: "A detailed skin diagnosis with a personalised daily care routine.",
    features: [
      "30-minute consultation with a dermatologist",
      "Skin type & concern assessment (photo-based)",
      "Custom morning & evening routine",
      "Ingredient guide — what to use & avoid",
      "Product recommendations by budget",
    ],
  },
  {
    name: "Glow Treatment",
    vx: 160_000,
    badge: "Most Popular",
    description: "A targeted treatment programme to address specific skin concerns.",
    features: [
      "3 expert sessions (acne, pigmentation, or anti-ageing focus)",
      "Personalised serum & moisturiser protocol",
      "Chemical peel guidance",
      "SPF & sun protection plan",
      "Weekly progress check-ins",
      "Before & after skin comparison",
    ],
  },
  {
    name: "Premium Skin Programme",
    vx: 350_000,
    description: "A comprehensive 2-month skin transformation with a dedicated dermatologist.",
    features: [
      "6 dermatologist sessions",
      "Customised prescription-strength regimen",
      "Professional-grade product kit",
      "Hormonal & dietary skin link analysis",
      "Microneedling or peeling protocol",
      "Unlimited messaging support",
      "Final skin health report",
    ],
  },
];

const highlights = [
  { icon: Sparkles, label: "Specialists",   value: "Board-certified dermatologists" },
  { icon: Star,     label: "Skin Types",    value: "Dry, oily, combination, sensitive & acne-prone" },
  { icon: Clock,    label: "Results",       value: "Visible improvement in 4 – 6 weeks" },
  { icon: Shield,   label: "Products",      value: "Dermatologist-tested, fragrance-free formulas" },
];

export default function SkinCareExpert() {
  return (
    <ServiceRequestPage
      title="Skin Care Expert"
      subtitle="Personalised dermatology care and skincare plans for radiant, healthy skin."
      icon={Sparkles}
      heroImage={heroImg}
      serviceType="Skin Care"
      packages={packages}
      highlights={highlights}
    />
  );
}
