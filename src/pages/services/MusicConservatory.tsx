import ServiceRequestPage from "./ServiceRequestPage";
import { Music, Clock, Users, Star } from "lucide-react";
import heroImg from "@/assets/service-music.jpg";

const packages = [
  {
    name: "Beginner Course",
    vx: 60_000,
    description: "Start your musical journey with foundational theory and your first instrument.",
    features: [
      "8 weekly live sessions (45 min each)",
      "Instrument of choice: Piano, Guitar, or Violin",
      "Music theory fundamentals",
      "Practice exercises & sheet music",
      "Progress assessment at end of course",
    ],
  },
  {
    name: "Intermediate Programme",
    vx: 140_000,
    badge: "Best Value",
    description: "Advance your skills with repertoire building and performance techniques.",
    features: [
      "12 weekly live sessions (60 min each)",
      "Choice of instrument or vocal",
      "Repertoire study (classical & contemporary)",
      "Music theory — intermediate level",
      "1 recorded performance review",
      "Certificate of completion",
    ],
  },
  {
    name: "Pro Production & Performance",
    vx: 300_000,
    description: "Master your craft with studio production skills and live performance coaching.",
    features: [
      "16 weekly sessions (75 min each)",
      "DAW / music production module",
      "Live performance & stagecraft coaching",
      "Advanced harmony & arrangement",
      "Studio recording session (1 hr)",
      "Personalised artist development plan",
      "Priority booking with senior instructors",
    ],
  },
];

const highlights = [
  { icon: Users,  label: "Instructors",    value: "Professional musicians & educators" },
  { icon: Clock,  label: "Session Length", value: "45 – 75 min live per week" },
  { icon: Star,   label: "Instruments",    value: "Piano, Guitar, Violin, Vocal & more" },
  { icon: Music,  label: "Styles",         value: "Classical, Contemporary & Production" },
];

export default function MusicConservatory() {
  return (
    <ServiceRequestPage
      title="Music Conservatory"
      subtitle="Learn music from professional instructors — from beginner to performer."
      icon={Music}
      heroImage={heroImg}
      serviceType="Music Conservatory"
      packages={packages}
      highlights={highlights}
    />
  );
}
