import type { CertificateEntry } from "../types";

export const MOCK_CERTIFICATES: CertificateEntry[] = [
  { id: "cert-1", title: "Web Accessibility Specialist (WAS)", issuer: "IAAP", issueDate: "2024-03-01", expiryDate: "2027-03-01", credentialId: "WAS-88213" },
  { id: "cert-2", title: "AWS Certified Cloud Practitioner", issuer: "Amazon Web Services", issueDate: "2023-08-15", expiryDate: "2026-08-15", credentialId: "AWS-CCP-40921" },
  { id: "cert-3", title: "Advanced React Patterns", issuer: "VisionEx Academy", issueDate: "2025-01-20", expiryDate: null, credentialId: "VXA-77410" },
];
