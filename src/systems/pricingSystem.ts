/**
 * Centralized VX pricing for all platform services.
 * Rate: 1000 VX = 1 USD
 */

export const VX_RATE = 1000; // VX per USD

// ── Gaming Zone ──
export const GAMING_PRICES = {
  singlePlay: 200,
  fullGameUnlock: 2000,
  weeklyPass: 5000,
} as const;

// ── Academy (Courses) ──
export const ACADEMY_PRICES = {
  miniCourse: 4000,
  intermediateCourse: 12000,
  professionalMasterclass: 35000,
  digitalCertificate: 3000,
} as const;

// ── Simulators ──
export const SIMULATION_PRICES = {
  singleSession: 1000,
  monthlyPass: 15000,
  lifetimeAccess: 25000,
} as const;

// ── Professional Tools (Windows .bat) ──
export const PRO_TOOL_PRICES = {
  singleTool: 1000,
} as const;

// ── Technical Services ──
export const TECH_SERVICE_PRICES = {
  fileDownload: 500,
  techConsultation: 2500,
  remoteSupport: 10000,
} as const;

// ── Account Features ──
export const ACCOUNT_PRICES = {
  changeUsername: 1000,
  monthlyVip: 8000,
  removeAds: 5000,
} as const;

// ── Earning System ──
export const EARNING_RATES = {
  watchAd: 2,
  referFriend: 200,
  dailyLogin: 10,
} as const;

/** Convert VX to USD string */
export function vxToUsd(vx: number): string {
  return `$${(vx / VX_RATE).toFixed(2)}`;
}

/** Format VX with locale separator */
export function formatVX(vx: number): string {
  return `${vx.toLocaleString()} VX`;
}
