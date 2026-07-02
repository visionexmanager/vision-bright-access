import type { VisaCountryIntel } from "../types";

export const VISA_INTEL: VisaCountryIntel[] = [
  { country: "Canada", visaEaseScore: 88, sponsorshipIndex: 82, relocationDifficulty: 28, migrationFriendlyJobs: ["Software Developer", "Nurse", "Data Analyst"], immigrationPaths: ["Express Entry", "Provincial Nominee Program"] },
  { country: "Germany", visaEaseScore: 79, sponsorshipIndex: 75, relocationDifficulty: 38, migrationFriendlyJobs: ["Software Engineer", "Mechanical Engineer", "Nurse"], immigrationPaths: ["EU Blue Card", "Skilled Worker Visa"] },
  { country: "United Kingdom", visaEaseScore: 71, sponsorshipIndex: 68, relocationDifficulty: 42, migrationFriendlyJobs: ["Software Developer", "Data Scientist", "Doctor"], immigrationPaths: ["Skilled Worker Visa", "Global Talent Visa"] },
  { country: "Australia", visaEaseScore: 74, sponsorshipIndex: 70, relocationDifficulty: 45, migrationFriendlyJobs: ["Nurse", "Software Engineer", "Tradesperson"], immigrationPaths: ["Skilled Independent Visa", "Employer Sponsored Visa"] },
  { country: "United Arab Emirates", visaEaseScore: 66, sponsorshipIndex: 85, relocationDifficulty: 24, migrationFriendlyJobs: ["Finance Professional", "IT Specialist", "Hospitality Manager"], immigrationPaths: ["Employment Visa", "Golden Visa"] },
  { country: "Portugal", visaEaseScore: 77, sponsorshipIndex: 60, relocationDifficulty: 30, migrationFriendlyJobs: ["Software Developer", "Remote Worker (D8 Visa)"], immigrationPaths: ["D8 Digital Nomad Visa", "Job Seeker Visa"] },
];
