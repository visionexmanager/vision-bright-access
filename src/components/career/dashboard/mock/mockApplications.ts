import type { JobApplication } from "../types";

export const MOCK_APPLICATIONS: JobApplication[] = [
  { id: "app-1", jobTitle: "Senior Frontend Engineer", companyName: "Nova Systems", companyColor: "#6366f1", status: "interview", appliedDate: "2026-06-20", location: "Remote" },
  { id: "app-2", jobTitle: "AI Prompt Engineer", companyName: "Vertex AI Labs", companyColor: "#a855f7", status: "reviewing", appliedDate: "2026-06-25", location: "Remote" },
  { id: "app-3", jobTitle: "Product Designer", companyName: "Clearview Design Studio", companyColor: "#ec4899", status: "applied", appliedDate: "2026-06-29", location: "Remote" },
  { id: "app-4", jobTitle: "Frontend Developer", companyName: "Atlas Finance Group", companyColor: "#0ea5e9", status: "offer", appliedDate: "2026-06-10", location: "London, UK" },
  { id: "app-5", jobTitle: "Accessibility Engineer", companyName: "BrightPath Health", companyColor: "#10b981", status: "accepted", appliedDate: "2026-05-28", location: "Toronto, Canada" },
  { id: "app-6", jobTitle: "UI Engineer", companyName: "Orbit Manufacturing Co.", companyColor: "#f97316", status: "rejected", appliedDate: "2026-05-15", location: "Osaka, Japan" },
  { id: "app-7", jobTitle: "React Developer", companyName: "Greenfield Logistics", companyColor: "#f59e0b", status: "withdrawn", appliedDate: "2026-05-05", location: "Dubai, UAE" },
];
