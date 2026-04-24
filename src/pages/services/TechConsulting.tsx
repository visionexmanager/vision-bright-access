import ServiceRequestPage from "./ServiceRequestPage";
import { Headphones, Zap, Code2, Layers } from "lucide-react";
import heroImg from "@/assets/service-consulting.jpg";

const packages = [
  {
    name: "Strategy Session",
    vx: 60_000,
    description: "A focused 1-hour consultation with a senior tech expert.",
    features: [
      "1-hour video call",
      "Tech stack recommendations",
      "Problem diagnosis",
      "Action plan summary (written)",
      "1 follow-up Q&A via email",
    ],
  },
  {
    name: "Technical Audit",
    vx: 200_000,
    badge: "Most Popular",
    description: "Deep-dive review of your system, code, or infrastructure.",
    features: [
      "Full codebase / system review",
      "Security vulnerability scan",
      "Performance bottleneck analysis",
      "Scalability assessment",
      "Detailed written report",
      "30-minute debrief call",
    ],
  },
  {
    name: "Architecture Plan",
    vx: 420_000,
    description: "A complete technical roadmap for building or rebuilding your system.",
    features: [
      "System architecture design",
      "Database schema planning",
      "API design & integration plan",
      "Infrastructure & deployment strategy",
      "Technology selection rationale",
      "Implementation timeline",
      "2 revision rounds",
    ],
  },
];

const highlights = [
  { icon: Zap, label: "Response Time", value: "Within 24 hours" },
  { icon: Code2, label: "Expertise", value: "Web, Mobile, Cloud, AI" },
  { icon: Layers, label: "Experience", value: "Enterprise-grade advice" },
];

export default function TechConsulting() {
  return (
    <ServiceRequestPage
      title="Tech Consulting"
      subtitle="Senior technical guidance to solve complex problems and build better systems."
      icon={Headphones}
      heroImage={heroImg}
      serviceType="Tech Consulting"
      packages={packages}
      highlights={highlights}
    />
  );
}
