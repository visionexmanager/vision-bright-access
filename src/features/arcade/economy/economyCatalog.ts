export const LOGIN_REWARDS = Array.from({ length: 30 }, (_, index) => ({
  day: index + 1,
  vx: index === 29 ? 30 : (index + 1) % 7 === 0 ? 10 : 2,
}));

export const SHOP_ITEMS = [
  { sku: "frame-neon", name: "Neon Frame", type: "Frame", price: 120, description: "إطار تجميلي مضيء لملف اللاعب." },
  { sku: "theme-midnight", name: "Midnight Theme", type: "Theme", price: 200, description: "سمة داكنة تجميلية لـ Visionex Arcade." },
  { sku: "badge-founder", name: "Arcade Founder Badge", type: "Badge", price: 300, description: "شارة تجميلية خاصة بالملف." },
] as const;

export const TOURNAMENT_TYPES = [
  { period: "Daily", label: "بطولة يومية", duration: "24 ساعة" },
  { period: "Weekly", label: "بطولة أسبوعية", duration: "7 أيام" },
  { period: "Monthly", label: "بطولة شهرية", duration: "شهر" },
  { period: "Seasonal", label: "بطولة موسمية", duration: "مدة الموسم" },
] as const;

export const REWARD_RULES = [
  ["أول فوز موثّق", "5 VX"], ["مهمة يومية", "3 VX"], ["مهمة أسبوعية", "15 VX"],
  ["مستوى جديد", "5 VX"], ["إنجاز جديد", "3 VX"], ["فوز بطولة موثّق", "50 VX"],
  ["رقم قياسي موثّق", "4 VX"], ["سلسلة دخول", "2–30 VX"],
] as const;
