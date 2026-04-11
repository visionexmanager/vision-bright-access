import { Product } from "@/contexts/CartContext";

export const storeTypes = ["general", "accessibility"] as const;
export type StoreType = (typeof storeTypes)[number];

export const generalCategories = ["All", "Electronics", "Home", "Office", "Personal Care"] as const;
export const accessibilityCategories = ["All", "Software", "Hardware", "Design", "Media", "Learning", "Consulting"] as const;

export type GeneralCategory = (typeof generalCategories)[number];
export type AccessibilityCategory = (typeof accessibilityCategories)[number];

// Prices are in VX (1000 VX = 1 USD)
export const generalProducts: Product[] = [
  { id: "g1", name: "Wireless Earbuds Pro", description: "Noise-cancelling earbuds with 30-hour battery, touch controls, and crystal-clear audio.", price: 59990, category: "Electronics", points: 60, image: "🎧", rating: 4.7, inStock: true },
  { id: "g2", name: "Smart LED Desk Lamp", description: "Adjustable color temperature and brightness with USB charging port and timer.", price: 34990, category: "Electronics", points: 35, image: "💡", rating: 4.5, inStock: true },
  { id: "g3", name: "Ergonomic Office Chair", description: "Lumbar support, adjustable armrests, breathable mesh back for all-day comfort.", price: 249990, category: "Office", points: 200, image: "🪑", rating: 4.8, inStock: true },
  { id: "g4", name: "Portable Power Bank", description: "20,000mAh capacity with fast charging, dual USB-C ports, and LED indicator.", price: 29990, category: "Electronics", points: 30, image: "🔋", rating: 4.6, inStock: true },
  { id: "g5", name: "Electric Kettle", description: "1.7L stainless steel kettle with temperature presets and auto shut-off safety feature.", price: 39990, category: "Home", points: 40, image: "☕", rating: 4.4, inStock: true },
  { id: "g6", name: "Standing Desk Converter", description: "Adjustable sit-stand platform with keyboard tray. Fits on any desk surface.", price: 179990, category: "Office", points: 150, image: "🖥️", rating: 4.7, inStock: true },
  { id: "g7", name: "Digital Kitchen Scale", description: "Precision weighing with tare function, backlit display, and easy-clean surface.", price: 19990, category: "Home", points: 20, image: "⚖️", rating: 4.3, inStock: true },
  { id: "g8", name: "Wireless Mouse & Keyboard", description: "Slim, quiet combo with long battery life, multi-device support, and USB receiver.", price: 44990, category: "Office", points: 45, image: "🖱️", rating: 4.5, inStock: true },
  { id: "g9", name: "Electric Toothbrush", description: "Sonic cleaning with 5 modes, 2-minute timer, and 30-day rechargeable battery.", price: 49990, category: "Personal Care", points: 50, image: "🪥", rating: 4.6, inStock: true },
  { id: "g10", name: "Air Purifier", description: "HEPA filter for rooms up to 300 sq ft. Quiet night mode and air quality sensor.", price: 89990, category: "Home", points: 90, image: "🌬️", rating: 4.8, inStock: false },
];

export const accessibilityProducts: Product[] = [
  { id: "a1", name: "Screen Reader Pro", description: "Enterprise-grade screen reader with AI-powered page summarization and multi-language support.", price: 49990, category: "Software", points: 50, image: "🖥️", rating: 4.8, inStock: true },
  { id: "a2", name: "Voice Control Suite", description: "Complete hands-free computer control with custom voice commands and macro support.", price: 79990, category: "Software", points: 80, image: "🎙️", rating: 4.6, inStock: true },
  { id: "a3", name: "Braille Display 40-Cell", description: "Refreshable braille display with 40 cells, Bluetooth connectivity, and 20-hour battery.", price: 299990, category: "Hardware", points: 150, image: "⠿", rating: 4.9, inStock: true },
  { id: "a4", name: "Adaptive Keyboard", description: "High-contrast large-print keyboard with programmable keys and tactile feedback.", price: 89990, category: "Hardware", points: 90, image: "⌨️", rating: 4.7, inStock: true },
  { id: "a5", name: "Switch Access Kit", description: "USB switch interface with two adaptive switches for single-switch and scanning access.", price: 149990, category: "Hardware", points: 120, image: "🔘", rating: 4.5, inStock: false },
  { id: "a6", name: "High Contrast Theme Pack", description: "50+ professionally designed high-contrast themes for websites and applications.", price: 19990, category: "Design", points: 25, image: "🎨", rating: 4.4, inStock: true },
  { id: "a7", name: "Audio Description Toolkit", description: "Create professional audio descriptions for video content with AI-assisted scripting.", price: 59990, category: "Media", points: 60, image: "🔊", rating: 4.7, inStock: true },
  { id: "a8", name: "Caption Studio", description: "Real-time captioning software with 98% accuracy and multi-speaker detection.", price: 39990, category: "Media", points: 45, image: "💬", rating: 4.8, inStock: true },
  { id: "a9", name: "Accessibility Masterclass", description: "40-hour video course covering WCAG 2.2, ARIA, testing, and remediation techniques.", price: 99990, category: "Learning", points: 100, image: "🎓", rating: 4.9, inStock: true },
  { id: "a10", name: "Magnification Software", description: "Screen magnifier with smooth zoom up to 36x, color filters, and cursor enhancement.", price: 34990, category: "Software", points: 35, image: "🔎", rating: 4.4, inStock: true },
  { id: "a11", name: "A11y Audit Package", description: "Comprehensive accessibility audit with detailed report and prioritized remediation plan.", price: 349990, category: "Consulting", points: 250, image: "🔍", rating: 5.0, inStock: true },
  { id: "a12", name: "VPAT Report Service", description: "Professional VPAT/ACR report generation for your product's accessibility compliance.", price: 199990, category: "Consulting", points: 200, image: "📋", rating: 4.8, inStock: true },
];
