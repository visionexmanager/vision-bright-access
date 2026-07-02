/**
 * Academy XP — level calculation.
 *
 * Pure helper, no React/Supabase dependency. Shared by the Academy page today
 * and by any future module (Analytics, Certificates, …) that needs to render
 * a student's XP level.
 */

export interface AcademyXPLevelDef {
  label: string;
  min: number;
}

export const XP_LEVELS: AcademyXPLevelDef[] = [
  { label: "المبتدئ",        min: 0    },
  { label: "النابغة الصاعد", min: 100  },
  { label: "المتقدم",        min: 500  },
  { label: "الخبير",         min: 1000 },
  { label: "الأسطورة",       min: 2500 },
];

export interface AcademyXPLevel {
  label: string;
  current: number;
  target: number;
  percent: number;
}

export function getXPLevel(xp: number): AcademyXPLevel {
  const current = [...XP_LEVELS].reverse().find((l) => xp >= l.min) ?? XP_LEVELS[0];
  const nextIdx = XP_LEVELS.indexOf(current) + 1;
  const next    = XP_LEVELS[nextIdx];
  const target  = next?.min ?? current.min + 1000;
  const base    = current.min;
  const percent = Math.min(Math.round(((xp - base) / (target - base)) * 100), 100);
  return { label: current.label, current: xp - base, target: target - base, percent };
}
