/**
 * Centralized VX pricing for all platform services.
 * Rate: 1000 VX = 1 USD
 */

export const GAMING_PRICES = {
  singlePlay: 2,
  winReward: 3,
  lossPenalty: 3,
  fullGameUnlock: 500,
  weeklyPass: 2_000,
} as const;

export const ACADEMY_PRICES = {
  miniCourse: 2_000,
  intermediateCourse: 8_000,
  professionalMasterclass: 25_000,
  digitalCertificate: 1_500,
} as const;

export const SIMULATION_PRICES = {
  hourlyRate: 1_000,
  quarterHour: 250,
  quarterMinutes: 15,
  singleSession: 250,
  monthlyPass: 8_000,
  lifetimeAccess: 50_000,
} as const;

export const OCR_PRICES = {
  singleScan: 50,
  singleScanAudio: 100,
  pdfDocument: 300,
  bundleTen: 400,
} as const;

export const FILE_STUDIO_PRICES = {
  imageBase:     20,    // $0.02
  audioBase:     50,    // $0.05
  documentBase:  80,    // $0.08
  archiveBase:   30,    // $0.03
  videoBase:     200,   // $0.20
  developerBase: 10,    // $0.01
  aiToolsBase:   500,   // $0.50
  perMb:         1,     // 1 VX per MB
} as const;

export const EARNING_RATES = {
  watchAd: 2,
  referFriend: 200,
  dailyLogin: 10,
} as const;

export function formatVX(vx: number): string {
  return `${vx.toLocaleString()} VX`;
}
