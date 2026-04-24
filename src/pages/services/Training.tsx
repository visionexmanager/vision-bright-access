import ServiceRequestPage from "./ServiceRequestPage";
import { GraduationCap, Users, BookOpen, Award } from "lucide-react";
import heroImg from "@/assets/service-training.jpg";

const packages = [
  {
    name: "Online Workshop",
    vx: 100_000,
    description: "A focused 2-hour live training session tailored to your team.",
    features: [
      "Up to 10 participants",
      "2-hour live session (Zoom/Meet)",
      "Custom topic selection",
      "Session recording provided",
      "Q&A included",
      "Digital certificate",
    ],
  },
  {
    name: "Corporate Training",
    vx: 380_000,
    badge: "Most Popular",
    description: "A full-day intensive training experience for your organization.",
    features: [
      "Up to 30 participants",
      "Full-day session (6 hours)",
      "Custom curriculum design",
      "Training materials & workbooks",
      "Pre & post assessments",
      "Follow-up support (1 week)",
      "Certificates for all attendees",
    ],
  },
  {
    name: "Custom Program",
    vx: 650_000,
    description: "A multi-session training program designed from scratch for your needs.",
    features: [
      "Unlimited participants",
      "5 live sessions (schedule flexible)",
      "Fully bespoke curriculum",
      "Dedicated trainer assigned",
      "Progress tracking & reporting",
      "1-month post-training support",
      "Accredited certificates",
    ],
  },
];

const highlights = [
  { icon: Users, label: "Group Size", value: "Up to 30+ people" },
  { icon: BookOpen, label: "Topics", value: "Tech, Business, Soft Skills" },
  { icon: Award, label: "Certification", value: "Digital certificates included" },
];

export default function Training() {
  return (
    <ServiceRequestPage
      title="Professional Training"
      subtitle="Empower your team with targeted, expert-led training programs."
      icon={GraduationCap}
      heroImage={heroImg}
      serviceType="Professional Training"
      packages={packages}
      highlights={highlights}
    />
  );
}
