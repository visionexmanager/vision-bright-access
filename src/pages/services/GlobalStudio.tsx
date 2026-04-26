import ServiceRequestPage from "./ServiceRequestPage";
import { Globe, Clock, Users, Star } from "lucide-react";
import heroImg from "@/assets/service-studio.jpg";

const packages = [
  {
    name: "Content Starter",
    vx: 80_000,
    description: "Perfect for brands starting their visual identity journey.",
    features: [
      "5 branded social media graphics",
      "1 short promo video (60s)",
      "Logo usage guidelines",
      "Delivered in 5 business days",
    ],
  },
  {
    name: "Studio Growth",
    vx: 220_000,
    badge: "Most Popular",
    description: "A complete creative package for growing businesses.",
    features: [
      "10 branded graphics (all formats)",
      "2 promo videos (30s + 90s)",
      "Product photography (up to 20 shots)",
      "Brand color palette & typography guide",
      "2 revision rounds",
      "Delivered in 10 business days",
    ],
  },
  {
    name: "Full Production",
    vx: 500_000,
    description: "End-to-end creative production for enterprises.",
    features: [
      "Unlimited branded graphics (1 month)",
      "Full brand video (up to 3 min)",
      "Professional photo shoot (full day)",
      "Complete brand identity system",
      "Social media campaign kit",
      "Dedicated creative director",
      "Unlimited revisions",
    ],
  },
];

const highlights = [
  { icon: Clock,  label: "Turnaround",  value: "5 – 10 business days" },
  { icon: Users,  label: "Creative Team", value: "Designers, Videographers & Photographers" },
  { icon: Star,   label: "Formats",      value: "All digital & print formats included" },
  { icon: Globe,  label: "Languages",    value: "Arabic, English + 7 more" },
];

export default function GlobalStudio() {
  return (
    <ServiceRequestPage
      title="Global Studio"
      subtitle="Professional video, photography, and graphic design for your brand."
      icon={Globe}
      heroImage={heroImg}
      serviceType="Global Studio"
      packages={packages}
      highlights={highlights}
    />
  );
}
