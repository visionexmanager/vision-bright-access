import ServiceRequestPage from "./ServiceRequestPage";
import { Scale, Clock, Globe, Shield } from "lucide-react";
import heroImg from "@/assets/service-consulting.jpg";

const packages = [
  {
    name: "Legal Consultation",
    vx: 80_000,
    description: "A focused session with a qualified lawyer to clarify your legal situation.",
    features: [
      "60-minute video consultation",
      "Written summary of advice",
      "Applicable laws & references provided",
      "Initial risk assessment",
      "Available in Arabic, English & Turkish",
    ],
  },
  {
    name: "Document Review",
    vx: 220_000,
    badge: "Best Value",
    description: "Thorough review and drafting of contracts, agreements, or legal documents.",
    features: [
      "Review of up to 3 documents",
      "Plain-language explanation of each clause",
      "Identification of risks & red flags",
      "Suggested amendments with reasoning",
      "48-hour turnaround",
      "1 revision round included",
    ],
  },
  {
    name: "Full Legal Support",
    vx: 600_000,
    description: "Comprehensive legal representation and case management from start to finish.",
    features: [
      "Dedicated senior lawyer",
      "Unlimited consultations (1 month)",
      "Court filing & document preparation",
      "Negotiation & mediation support",
      "Weekly case progress updates",
      "Priority response within 2 hours",
      "Covers commercial, civil & family law",
    ],
  },
];

const highlights = [
  { icon: Scale,  label: "Practice Areas", value: "Commercial, Civil, Family & Labour Law" },
  { icon: Globe,  label: "Jurisdictions",  value: "Multi-country — MENA, EU & beyond" },
  { icon: Clock,  label: "Response Time",  value: "First response within 24 hours" },
  { icon: Shield, label: "Confidentiality", value: "Attorney-client privilege — 100% private" },
];

export default function LegalAdvisor() {
  return (
    <ServiceRequestPage
      title="Legal Advisor"
      subtitle="Expert legal counsel across commercial, civil, and family law — in your language."
      icon={Scale}
      heroImage={heroImg}
      serviceType="Legal Advisor"
      packages={packages}
      highlights={highlights}
    />
  );
}
