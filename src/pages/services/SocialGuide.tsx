import ServiceRequestPage from "./ServiceRequestPage";
import { Users, Heart, Globe, Clock } from "lucide-react";
import heroImg from "@/assets/service-career.jpg";

const packages = [
  {
    name: "Social Consultation",
    vx: 50_000,
    description: "A warm, supportive session with a certified social advisor to explore your needs.",
    features: [
      "60-minute confidential session",
      "Life situation assessment",
      "Community resources & support networks",
      "Practical next-steps plan",
      "Emotional support & active listening",
    ],
  },
  {
    name: "Life Navigation Package",
    vx: 180_000,
    badge: "Most Requested",
    description: "Ongoing social guidance to help you navigate life transitions with confidence.",
    features: [
      "4 weekly sessions with a social advisor",
      "Personalised social & life plan",
      "Help with housing, education, or employment queries",
      "Family mediation support (if needed)",
      "Connection to NGOs & legal aid",
      "Between-session check-in messages",
    ],
  },
  {
    name: "Full Life Transformation",
    vx: 450_000,
    description: "Intensive, compassionate support for complex life situations and major transitions.",
    features: [
      "8 sessions across 2 months",
      "Dedicated senior social guide",
      "Crisis support & emergency guidance",
      "Bureaucratic & administrative navigation",
      "Family & community integration plan",
      "Government services liaison support",
      "Monthly check-in for 3 months post-programme",
    ],
  },
];

const highlights = [
  { icon: Users,  label: "Advisors",     value: "Certified social workers & life coaches" },
  { icon: Heart,  label: "Approach",     value: "Empathy-first, non-judgmental support" },
  { icon: Globe,  label: "Languages",    value: "Arabic, English, Turkish, French & more" },
  { icon: Clock,  label: "Availability", value: "7 days a week — including weekends" },
];

export default function SocialGuide() {
  return (
    <ServiceRequestPage
      title="Social Guide"
      subtitle="Compassionate, professional support to help you navigate life's challenges with clarity."
      icon={Users}
      heroImage={heroImg}
      serviceType="Social Guide"
      packages={packages}
      highlights={highlights}
    />
  );
}
