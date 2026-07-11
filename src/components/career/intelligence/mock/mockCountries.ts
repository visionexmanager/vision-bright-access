import type { CountryJobData } from "../types";

// Illustrative dataset only — wire up to a real labor-market API (LinkedIn, Indeed, World Bank) later.
export const COUNTRY_JOB_DATA: CountryJobData[] = [
  { id: "us", name: "United States", lat: 38.9, lng: -77.0, hiringIntensity: 92, openJobs: 4200000, remoteRatio: 34, visaFriendly: false, topSkills: ["React", "Python", "AWS"], avgSalaryUsd: 98000 },
  { id: "gb", name: "United Kingdom", lat: 51.5, lng: -0.12, hiringIntensity: 78, openJobs: 980000, remoteRatio: 31, visaFriendly: true, topSkills: ["TypeScript", "SQL", "Data Analysis"], avgSalaryUsd: 68000 },
  { id: "de", name: "Germany", lat: 52.5, lng: 13.4, hiringIntensity: 81, openJobs: 1150000, remoteRatio: 28, visaFriendly: true, topSkills: ["Java", "Manufacturing Eng.", "SAP"], avgSalaryUsd: 72000 },
  { id: "ca", name: "Canada", lat: 45.4, lng: -75.7, hiringIntensity: 75, openJobs: 720000, remoteRatio: 30, visaFriendly: true, topSkills: ["React", "Nursing", "Data Science"], avgSalaryUsd: 71000 },
  { id: "ae", name: "United Arab Emirates", lat: 25.2, lng: 55.3, hiringIntensity: 70, openJobs: 340000, remoteRatio: 18, visaFriendly: true, topSkills: ["Finance", "Logistics", "Hospitality"], avgSalaryUsd: 64000 },
  { id: "au", name: "Australia", lat: -35.3, lng: 149.1, hiringIntensity: 73, openJobs: 610000, remoteRatio: 29, visaFriendly: true, topSkills: ["Mining Eng.", "Nursing", "React"], avgSalaryUsd: 74000 },
  { id: "in", name: "India", lat: 28.6, lng: 77.2, hiringIntensity: 88, openJobs: 5100000, remoteRatio: 22, visaFriendly: false, topSkills: ["Python", "Node.js", "AI/ML"], avgSalaryUsd: 22000 },
  { id: "de2", name: "Singapore", lat: 1.35, lng: 103.8, hiringIntensity: 69, openJobs: 210000, remoteRatio: 24, visaFriendly: true, topSkills: ["Fintech", "Data Engineering", "AI/ML"], avgSalaryUsd: 76000 },
  { id: "br", name: "Brazil", lat: -15.8, lng: -47.9, hiringIntensity: 62, openJobs: 1600000, remoteRatio: 26, visaFriendly: false, topSkills: ["Java", "Agribusiness", "Sales"], avgSalaryUsd: 24000 },
  { id: "jp", name: "Japan", lat: 35.7, lng: 139.7, hiringIntensity: 66, openJobs: 890000, remoteRatio: 15, visaFriendly: false, topSkills: ["Robotics", "Manufacturing", "Software Eng."], avgSalaryUsd: 58000 },
  { id: "za", name: "South Africa", lat: -25.7, lng: 28.2, hiringIntensity: 51, openJobs: 380000, remoteRatio: 20, visaFriendly: false, topSkills: ["Mining", "Finance", "Customer Support"], avgSalaryUsd: 19000 },
  { id: "eg", name: "Egypt", lat: 30.0, lng: 31.2, hiringIntensity: 55, openJobs: 450000, remoteRatio: 21, visaFriendly: false, topSkills: ["Software Dev.", "Tourism", "Manufacturing"], avgSalaryUsd: 14000 },
];
