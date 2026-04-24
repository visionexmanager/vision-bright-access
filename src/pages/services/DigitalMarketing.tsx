import ServiceRequestPage from "./ServiceRequestPage";
import { Megaphone, TrendingUp, Target, BarChart3 } from "lucide-react";
import heroImg from "@/assets/service-digital-marketing.jpg";

const packages = [
  {
    name: "Starter Campaign",
    vx: 120_000,
    description: "A focused marketing kickstart to get your brand visible online.",
    features: [
      "Social media audit (2 platforms)",
      "1-month content calendar",
      "5 branded post designs",
      "Audience targeting strategy",
      "Monthly performance report",
    ],
  },
  {
    name: "Growth Package",
    vx: 280_000,
    badge: "Best Value",
    description: "Multi-channel marketing management to grow your audience and conversions.",
    features: [
      "3-platform management",
      "Paid ads setup & management",
      "Weekly content creation (12 posts)",
      "Email marketing campaign",
      "Bi-weekly analytics reports",
      "A/B testing for ads",
    ],
  },
  {
    name: "Full Strategy",
    vx: 550_000,
    description: "An end-to-end marketing strategy to dominate your market.",
    features: [
      "Full brand & competitor analysis",
      "6-month marketing roadmap",
      "All platforms managed",
      "SEO content strategy",
      "Influencer outreach plan",
      "Weekly strategy calls",
      "Dedicated account manager",
    ],
  },
];

const highlights = [
  { icon: TrendingUp, label: "Average ROI", value: "3× – 8× ad spend" },
  { icon: Target, label: "Platforms", value: "Meta, Google, TikTok, X" },
  { icon: BarChart3, label: "Reporting", value: "Bi-weekly analytics" },
];

export default function DigitalMarketing() {
  return (
    <ServiceRequestPage
      title="Digital Marketing"
      subtitle="Data-driven campaigns that grow your audience and drive real results."
      icon={Megaphone}
      heroImage={heroImg}
      serviceType="Digital Marketing"
      packages={packages}
      highlights={highlights}
    />
  );
}
