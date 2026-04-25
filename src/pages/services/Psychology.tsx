import ServiceRequestPage from "./ServiceRequestPage";
import { Brain, Clock, Heart, Shield } from "lucide-react";
import heroImg from "@/assets/service-career.jpg";

const packages = [
  {
    name: "First Session",
    vx: 60_000,
    description: "A safe, confidential space to talk and begin understanding your mental health.",
    features: [
      "50-minute session with a licensed therapist",
      "Initial mental health assessment",
      "Discussion of goals & concerns",
      "Recommended therapy approach",
      "Self-care tips & resources",
    ],
  },
  {
    name: "4-Session Package",
    vx: 200_000,
    badge: "Recommended",
    description: "A focused programme to work through specific challenges with consistent support.",
    features: [
      "4 weekly 50-minute therapy sessions",
      "Personalised treatment plan",
      "Between-session check-in messages",
      "Cognitive behavioural techniques (CBT)",
      "Mood tracking & reflection exercises",
      "Session summaries after each meeting",
    ],
  },
  {
    name: "Monthly Therapy Plan",
    vx: 500_000,
    description: "Ongoing therapeutic support for lasting mental wellness and personal growth.",
    features: [
      "8 sessions across 30 days (2/week)",
      "Dedicated licensed psychologist",
      "Comprehensive mental health assessment",
      "Personalised CBT + mindfulness plan",
      "Unlimited messaging support",
      "Family or couples session (1 included)",
      "Progress report & continued care plan",
    ],
  },
];

const highlights = [
  { icon: Brain,  label: "Therapists",    value: "Licensed clinical psychologists" },
  { icon: Heart,  label: "Specialisms",   value: "Anxiety, depression, trauma, relationships & more" },
  { icon: Clock,  label: "Sessions",      value: "Flexible scheduling — your timezone" },
  { icon: Shield, label: "Confidential",  value: "Zero data sharing — your privacy protected" },
];

export default function Psychology() {
  return (
    <ServiceRequestPage
      title="Psychology & Mental Health"
      subtitle="Professional therapy and mental wellness support — compassionate, confidential, effective."
      icon={Brain}
      heroImage={heroImg}
      serviceType="Psychology"
      packages={packages}
      highlights={highlights}
    />
  );
}
