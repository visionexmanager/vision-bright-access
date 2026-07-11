import type { FakeJobAnalysis, FakeJobFlag } from "./types";

// Local keyword-heuristic detector — mirrors real-world fake-job red flags.
// Swap for a trained classifier / real fraud-detection API later.
const SCAM_PATTERNS: RegExp[] = [/wire transfer/i, /processing fee/i, /pay upfront/i, /send.{0,15}(money|payment)/i, /gift card/i, /registration fee/i];
const URGENCY_PATTERNS: RegExp[] = [/no interview/i, /immediate hire/i, /start (today|tomorrow)/i, /urgent(ly)? hiring/i, /apply now.{0,10}limited/i];
const SALARY_HYPE_PATTERNS: RegExp[] = [/unlimited income/i, /\$\s?\d{3,}\s?\/\s?(day|week)/i, /easy money/i, /guaranteed.{0,10}income/i, /work.{0,10}(2|two).{0,10}hours.{0,10}day/i];
const VAGUE_COMPANY_PATTERNS: RegExp[] = [/confidential company/i, /a leading company/i, /our client/i, /well-?known company/i];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

export function detectFakeJob(text: string): FakeJobAnalysis {
  const flags: FakeJobFlag[] = [];
  let signalCount = 0;

  const scamHits = countMatches(text, SCAM_PATTERNS);
  if (scamHits > 0) { flags.push("scamListing"); signalCount += scamHits; }

  const urgencyHits = countMatches(text, URGENCY_PATTERNS);
  if (urgencyHits > 0) { flags.push("fakeJob"); signalCount += urgencyHits; }

  const salaryHits = countMatches(text, SALARY_HYPE_PATTERNS);
  if (salaryHits > 0) { flags.push("misleadingSalary"); signalCount += salaryHits; }

  const vagueCompanyHits = countMatches(text, VAGUE_COMPANY_PATTERNS);
  if (vagueCompanyHits > 0) { flags.push("suspiciousCompany"); signalCount += vagueCompanyHits; }

  if (text.trim().length > 0 && text.trim().length < 120) {
    flags.push("duplicateListing");
    signalCount += 1;
  }

  const riskScore = Math.min(96, signalCount * 18 + (flags.length > 0 ? 10 : 4));
  const confidence = Math.min(97, 55 + signalCount * 8);

  const explanation =
    flags.length === 0
      ? "No common fraud indicators were detected in this listing. It reads like a typical, well-structured job posting."
      : `This listing shows ${signalCount} red-flag signal${signalCount === 1 ? "" : "s"} commonly associated with fraudulent postings, including ${flags.map((f) => f.replace(/([A-Z])/g, " $1").toLowerCase()).join(", ")}.`;

  return { riskScore, confidence, flags, explanation };
}
