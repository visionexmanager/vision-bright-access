/**
 * Centralized VX pricing for all platform services.
 * Rate: 1000 VX = 1 USD
 */

// ── Gaming Zone ──
// 1000 VX = $1 USD
export const GAMING_PRICES = {
  singlePlay:     2,      // $0.002 — entry, nearly free
  fullGameUnlock: 500,    // $0.50  — unlock one game forever
  weeklyPass:     2_000,  // $2.00  — unlimited play for a week
} as const;

// ── Academy (Courses) ──
export const ACADEMY_PRICES = {
  miniCourse:               2_000,   // $2
  intermediateCourse:       8_000,   // $8
  professionalMasterclass:  25_000,  // $25
  digitalCertificate:       1_500,   // $1.50
} as const;

// ── Simulators ──
export const SIMULATION_PRICES = {
  singleSession:  10,      // $0.01  — entry, try it out
  monthlyPass:    8_000,   // $8.00  — unlimited sessions for a month
  lifetimeAccess: 50_000,  // $50.00 — lifetime unlimited access
} as const;

// ── OCR / Document Scanner ──
export const OCR_PRICES = {
  singleScan:      50,   // text extraction only
  singleScanAudio: 100,  // text + TTS audio
  pdfDocument:     300,  // PDF up to 5 pages
  bundleTen:       400,  // 10 scans bundle
} as const;

// ── Earning System ──
export const EARNING_RATES = {
  watchAd: 2,
  referFriend: 200,
  dailyLogin: 10,
} as const;

/** Format VX with locale separator */
export function formatVX(vx: number): string {
  return `${vx.toLocaleString()} VX`;
}
