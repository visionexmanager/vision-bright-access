/** Shared onboarding option lists — split out of AcademyOnboarding.tsx so that
 * component file only exports the component itself (react-refresh/only-export-components). */
export const ACADEMY_ONBOARDING_COUNTRIES = ["لبنان", "مصر", "السعودية", "تركيا", "أمريكا", "بلد آخر"];
export const ACADEMY_ONBOARDING_LEVELS    = ["ابتدائي", "متوسط", "ثانوي / بكالوريا", "جامعي / دراسات"];

const COUNTRY_KEYS = ["lb", "eg", "sa", "tr", "us", "other"] as const;
const LEVEL_KEYS = ["primary", "middle", "high", "uni"] as const;

export function localizeAcademyProfileValue(value: string, t: (key: string) => string): string {
  const countryIndex = ACADEMY_ONBOARDING_COUNTRIES.indexOf(value);
  if (countryIndex >= 0) return t(`academy.country.${COUNTRY_KEYS[countryIndex]}`);

  const levelIndex = ACADEMY_ONBOARDING_LEVELS.indexOf(value);
  if (levelIndex >= 0) return t(`academy.level.${LEVEL_KEYS[levelIndex]}`);

  return value;
}
