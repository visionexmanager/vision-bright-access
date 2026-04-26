import ServiceRequestPage from "./ServiceRequestPage";
import { Stethoscope, Clock, Shield, Users } from "lucide-react";
import heroImg from "@/assets/service-consulting.jpg";

const packages = [
  {
    name: "Health Assessment",
    vx: 60_000,
    description: "A thorough initial health review with a qualified medical professional.",
    features: [
      "45-minute consultation with a licensed doctor",
      "Symptom analysis & medical history review",
      "Basic diagnostic guidance",
      "Lab test recommendations",
      "Written health summary report",
    ],
  },
  {
    name: "Specialist Consultation",
    vx: 160_000,
    badge: "Most Requested",
    description: "Targeted consultation with the specialist most suited to your condition.",
    features: [
      "Specialist match: General, Cardiology, Paediatrics, Ophthalmology & more",
      "60-minute in-depth session",
      "Diagnosis & treatment recommendations",
      "Prescription guidance (non-dispensing)",
      "Referral letter if needed",
      "Follow-up message support (7 days)",
    ],
  },
  {
    name: "Comprehensive Health Plan",
    vx: 400_000,
    description: "Ongoing medical supervision and a fully personalised health management plan.",
    features: [
      "3 specialist consultations (any field)",
      "Personalised health & medication plan",
      "Monthly health check-in calls",
      "Priority specialist access",
      "Lab result review & interpretation",
      "Emergency triage advice line",
      "Connections to trusted local clinics",
    ],
  },
];

const highlights = [
  { icon: Stethoscope, label: "Specialists",    value: "20+ medical specialties available" },
  { icon: Clock,       label: "Availability",   value: "7 days a week, including evenings" },
  { icon: Users,       label: "Languages",      value: "Arabic, English, Turkish & French" },
  { icon: Shield,      label: "Privacy",        value: "HIPAA-aligned — fully confidential" },
];

export default function MedicalSupport() {
  return (
    <ServiceRequestPage
      title="Medical Support"
      subtitle="Licensed doctors and specialists available to guide your health — wherever you are."
      icon={Stethoscope}
      heroImage={heroImg}
      serviceType="Medical Support"
      packages={packages}
      highlights={highlights}
    />
  );
}
