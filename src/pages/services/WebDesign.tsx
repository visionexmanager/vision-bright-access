import ServiceRequestPage from "./ServiceRequestPage";
import { MonitorSmartphone, Clock, Shield, Globe } from "lucide-react";
import heroImg from "@/assets/service-web-design.jpg";

const packages = [
  {
    name: "Landing Page",
    vx: 150_000,
    description: "A professional single-page website optimized for conversions.",
    features: [
      "Responsive design (mobile + desktop)",
      "Contact / lead form",
      "SEO meta tags",
      "1 revision round",
      "Delivered in 7 days",
    ],
  },
  {
    name: "Business Website",
    vx: 500_000,
    badge: "Most Popular",
    description: "A complete multi-page site for your business or brand.",
    features: [
      "Up to 10 pages",
      "Content management system",
      "Basic SEO setup",
      "Google Analytics integration",
      "2 revision rounds",
      "Delivered in 21 days",
    ],
  },
  {
    name: "E-Commerce Store",
    vx: 900_000,
    description: "A fully functional online store ready to accept orders.",
    features: [
      "Unlimited product listings",
      "Payment gateway integration",
      "Order management dashboard",
      "Inventory tracking",
      "3 revision rounds",
      "Delivered in 35 days",
    ],
  },
];

const highlights = [
  { icon: Clock, label: "Delivery Time", value: "7 – 35 days" },
  { icon: Shield, label: "Guarantee", value: "Satisfaction or refund" },
  { icon: Globe, label: "Technology", value: "React / WordPress / Shopify" },
];

export default function WebDesign() {
  return (
    <ServiceRequestPage
      title="Web Design & Development"
      subtitle="Professional websites built for performance, accessibility, and results."
      icon={MonitorSmartphone}
      heroImage={heroImg}
      serviceType="Web Design"
      packages={packages}
      highlights={highlights}
    />
  );
}
