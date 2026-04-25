import ServiceRequestPage from "./ServiceRequestPage";
import { Dumbbell, Clock, Trophy, Activity } from "lucide-react";
import heroImg from "@/assets/service-training.jpg";

const packages = [
  {
    name: "Fitness Assessment",
    vx: 40_000,
    description: "A comprehensive fitness evaluation and personalised starter workout plan.",
    features: [
      "45-minute assessment with a certified coach",
      "Body composition & fitness level analysis",
      "Goal setting session",
      "4-week starter workout plan",
      "Nutritional guidelines overview",
    ],
  },
  {
    name: "Monthly Training Programme",
    vx: 120_000,
    badge: "Best Value",
    description: "A structured, coach-guided monthly fitness programme tailored to your goals.",
    features: [
      "4 live coaching sessions (1/week, 60 min)",
      "Full monthly workout plan (3–5 days/week)",
      "Exercise video library access",
      "Weekly performance check-ins",
      "Nutrition & hydration plan",
      "Progress tracking & adjustments",
    ],
  },
  {
    name: "Elite Performance",
    vx: 300_000,
    description: "High-performance coaching for athletes and those pursuing peak fitness results.",
    features: [
      "8 live coaching sessions (2/week)",
      "Periodised training programme",
      "Sport-specific conditioning plan",
      "Advanced nutrition & recovery plan",
      "Daily check-in messages",
      "Injury prevention & mobility work",
      "End-of-programme performance test & report",
    ],
  },
];

const highlights = [
  { icon: Dumbbell,  label: "Coaches",       value: "Certified personal trainers & sports coaches" },
  { icon: Trophy,    label: "Specialisms",   value: "Weight loss, muscle gain, endurance & sports" },
  { icon: Activity,  label: "Programmes",    value: "Home, gym, or outdoor — your choice" },
  { icon: Clock,     label: "Flexibility",   value: "Sessions fit your schedule & timezone" },
];

export default function SportsCoach() {
  return (
    <ServiceRequestPage
      title="Sports & Fitness Coach"
      subtitle="Expert personal training and performance coaching to achieve your fitness goals."
      icon={Dumbbell}
      heroImage={heroImg}
      serviceType="Sports Coach"
      packages={packages}
      highlights={highlights}
    />
  );
}
