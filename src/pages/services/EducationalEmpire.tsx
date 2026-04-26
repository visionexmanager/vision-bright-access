import ServiceRequestPage from "./ServiceRequestPage";
import { GraduationCap, Users, Globe, BarChart3 } from "lucide-react";
import heroImg from "@/assets/academy-illustration.jpg";

const packages = [
  {
    name: "Foundation Plan",
    vx: 200_000,
    description: "Launch a single online institution with a professional LMS, branding, and certification system.",
    features: [
      "Custom institution branding & domain setup",
      "Learning Management System (LMS) configuration",
      "Up to 5 structured courses with modules & quizzes",
      "Student enrolment portal",
      "Certificate & diploma issuance system",
      "Payment gateway integration",
      "3 months of technical support",
    ],
  },
  {
    name: "Growth Empire",
    vx: 600_000,
    badge: "Most Popular",
    description: "Scale to multiple branches with instructor management, analytics, and a mobile-ready platform.",
    features: [
      "Everything in Foundation Plan",
      "Up to 5 branch campuses (online or physical)",
      "Instructor recruitment & management portal",
      "Live classes & webinar integration",
      "Student progress & performance analytics",
      "Mobile-responsive platform (iOS & Android ready)",
      "Multi-currency payment support",
      "6 months of dedicated account management",
    ],
  },
  {
    name: "Global Empire",
    vx: 1_500_000,
    description: "A full white-label educational ecosystem with unlimited capacity, API integrations, and a dedicated tech team.",
    features: [
      "Everything in Growth Empire",
      "Unlimited branches & course catalogue",
      "White-label platform (your brand, your domain)",
      "API integrations with external tools (Zoom, Slack, HR systems)",
      "AI-powered personalised learning paths",
      "Revenue-sharing model setup for partner instructors",
      "Accreditation & compliance consulting",
      "Dedicated senior tech team for 12 months",
    ],
  },
];

const highlights = [
  { icon: GraduationCap, label: "Certification",  value: "ISO-aligned certificates & diplomas" },
  { icon: Users,         label: "Capacity",       value: "Unlimited students, no limits" },
  { icon: Globe,         label: "Reach",           value: "Multi-language, 50+ countries" },
  { icon: BarChart3,     label: "Analytics",       value: "Real-time performance dashboards" },
];

export default function EducationalEmpire() {
  return (
    <ServiceRequestPage
      title="Global Educational Empire"
      subtitle="Build and manage your own educational institution — from a single classroom to a worldwide academy network."
      icon={GraduationCap}
      heroImage={heroImg}
      serviceType="Educational Empire"
      packages={packages}
      highlights={highlights}
    />
  );
}
