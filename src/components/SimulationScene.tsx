/**
 * SimulationScene — immersive multi-layer CSS scene for every simulation.
 * Renders a living environment (sky + structures + animated characters + particles)
 * and plays continuous ambient sound.  Reacts visually to isActive / isComplete.
 */

import { useEffect, useRef, useState } from "react";
import { useAmbientSound, getSimulationAmbient } from "@/hooks/useAmbientSound";

// ── Types ────────────────────────────────────────────────────────────────────

type SceneType = "farm" | "kitchen" | "lab" | "workshop" | "electronics" | "enterprise" | "digital";

interface CharacterDef {
  emoji: string;
  left: number;   // %
  bottom: number; // px from scene bottom
  size: number;   // rem
  anim: string;   // CSS animation shorthand
  zIndex?: number;
}

interface ParticleDef {
  emoji: string;
  left: number;
  delay: number;  // s
  duration: number; // s
  size: string;
}

interface SceneDef {
  type: SceneType;
  sky: string;        // CSS gradient for sky/bg
  horizon: string;    // CSS gradient for ground/floor
  structures: StructureDef[];
  characters: CharacterDef[];
  particles: ParticleDef[];
  activeOverlay?: string;  // extra tint when active
  label: string;
}

interface StructureDef {
  shape: "barn" | "tree" | "tank" | "flask" | "rack" | "counter" | "panel" | "building" | "fence";
  left: number;  // %
  bottom: number; // px
  color?: string;
  scale?: number;
}

// ── Animation helpers ────────────────────────────────────────────────────────

const WALK_L = "sim-walk 3.2s ease-in-out infinite";
const WALK_R = "sim-walk 4s ease-in-out infinite reverse";
const BOB    = "sim-bob 2s ease-in-out infinite";
const FLOAT  = "sim-float-up 3.5s ease-in-out infinite";
const SWAY   = "sim-sway 4s ease-in-out infinite";
const BLINK  = "sim-blink 1.8s step-end infinite";
const BLINK2 = "sim-blink 2.3s 0.9s step-end infinite";
const PULSE  = "sim-pulse 2.5s ease-in-out infinite";

// ── Scene definitions ────────────────────────────────────────────────────────

const SCENES: Record<string, SceneDef> = {
  // ── FARM SCENES ─────────────────────────────────────────────────────────────
  "poultry-farm": {
    type: "farm",
    sky: "linear-gradient(180deg, #5ba8e5 0%, #87ceeb 55%, #d4edff 100%)",
    horizon: "linear-gradient(180deg, #8bc34a 0%, #558b2f 60%, #4a7526 100%)",
    structures: [
      { shape: "barn",  left: 68, bottom: 32, color: "#b5451b", scale: 1.1 },
      { shape: "tree",  left: 82, bottom: 32, color: "#2e7d32" },
      { shape: "fence", left: 5,  bottom: 28 },
    ],
    characters: [
      { emoji: "🐔", left: 15, bottom: 30, size: 2.2, anim: WALK_L },
      { emoji: "🐔", left: 30, bottom: 29, size: 1.9, anim: `sim-bob 2.4s 0.6s ease-in-out infinite` },
      { emoji: "🥚", left: 22, bottom: 28, size: 1.4, anim: BOB },
      { emoji: "🐤", left: 42, bottom: 29, size: 1.7, anim: WALK_R },
      { emoji: "☀️",  left: 88, bottom: 110, size: 2.8, anim: PULSE, zIndex: 0 },
    ],
    particles: [
      { emoji: "🌾", left: 10, delay: 0,   duration: 4,   size: "1rem" },
      { emoji: "🌾", left: 50, delay: 1.5, duration: 4.5, size: "1rem" },
      { emoji: "🍃", left: 75, delay: 0.8, duration: 5,   size: "0.9rem" },
    ],
    label: "🐔 Poultry Farm",
  },

  "dairy-farm": {
    type: "farm",
    sky: "linear-gradient(180deg, #4aa3df 0%, #74b9ff 55%, #dff9fb 100%)",
    horizon: "linear-gradient(180deg, #55efc4 0%, #00b894 60%, #006650 100%)",
    structures: [
      { shape: "barn",  left: 65, bottom: 32, color: "#e17055", scale: 1.2 },
      { shape: "tank",  left: 78, bottom: 28, color: "#b2bec3" },
      { shape: "fence", left: 5,  bottom: 28 },
    ],
    characters: [
      { emoji: "🐄", left: 12, bottom: 30, size: 2.8, anim: WALK_L },
      { emoji: "🐄", left: 38, bottom: 29, size: 2.4, anim: SWAY },
      { emoji: "🥛", left: 55, bottom: 29, size: 1.8, anim: BOB },
      { emoji: "☀️",  left: 87, bottom: 112, size: 2.6, anim: PULSE, zIndex: 0 },
    ],
    particles: [
      { emoji: "🌿", left: 8,  delay: 0,   duration: 4.5, size: "1rem" },
      { emoji: "💧", left: 45, delay: 1,   duration: 3.8, size: "0.9rem" },
      { emoji: "🌿", left: 70, delay: 2,   duration: 5,   size: "1rem" },
    ],
    label: "🐄 Dairy Farm",
  },

  "cattle-dairy": {
    type: "farm",
    sky: "linear-gradient(180deg, #5dade2 0%, #85c1e9 55%, #d6eaf8 100%)",
    horizon: "linear-gradient(180deg, #82e0aa 0%, #27ae60 60%, #1e8449 100%)",
    structures: [
      { shape: "barn",  left: 66, bottom: 32, color: "#922b21", scale: 1.3 },
      { shape: "tree",  left: 80, bottom: 32 },
      { shape: "fence", left: 4,  bottom: 28 },
    ],
    characters: [
      { emoji: "🐄", left: 10, bottom: 30, size: 3,   anim: WALK_L },
      { emoji: "🐂", left: 35, bottom: 29, size: 2.6, anim: SWAY },
      { emoji: "🌱", left: 50, bottom: 28, size: 1.8, anim: BOB },
      { emoji: "☀️",  left: 86, bottom: 115, size: 2.8, anim: PULSE, zIndex: 0 },
    ],
    particles: [
      { emoji: "🌾", left: 12, delay: 0.3, duration: 4, size: "1rem" },
      { emoji: "🌿", left: 55, delay: 1.2, duration: 5, size: "1rem" },
    ],
    label: "🐄 Cattle Ranch",
  },

  "sheep-farm": {
    type: "farm",
    sky: "linear-gradient(180deg, #5dade2 0%, #abebc6 55%, #eafaf1 100%)",
    horizon: "linear-gradient(180deg, #a9dfbf 0%, #1e8449 60%, #196f3d 100%)",
    structures: [
      { shape: "barn",  left: 70, bottom: 32, color: "#784212", scale: 1 },
      { shape: "tree",  left: 83, bottom: 32 },
      { shape: "fence", left: 5,  bottom: 28 },
    ],
    characters: [
      { emoji: "🐑", left: 12, bottom: 30, size: 2.5, anim: WALK_L },
      { emoji: "🐑", left: 32, bottom: 29, size: 2.2, anim: SWAY },
      { emoji: "✂️", left: 50, bottom: 30, size: 2,   anim: BOB },
      { emoji: "🧶", left: 60, bottom: 29, size: 1.8, anim: `sim-bob 3s 0.5s ease-in-out infinite` },
      { emoji: "☁️",  left: 25, bottom: 120, size: 2.4, anim: `sim-drift-r 18s linear infinite`, zIndex: 0 },
    ],
    particles: [
      { emoji: "🌿", left: 8,  delay: 0,   duration: 5, size: "1rem" },
      { emoji: "🌸", left: 58, delay: 1.5, duration: 4, size: "0.9rem" },
    ],
    label: "🐑 Sheep Farm",
  },

  "egg-incubator": {
    type: "farm",
    sky: "linear-gradient(180deg, #f39c12 0%, #f8c471 55%, #fef9e7 100%)",
    horizon: "linear-gradient(180deg, #fad7a0 0%, #e59866 60%, #ca6f1e 100%)",
    structures: [
      { shape: "barn", left: 65, bottom: 32, color: "#7d6608", scale: 0.9 },
    ],
    characters: [
      { emoji: "🥚", left: 15, bottom: 30, size: 2.4, anim: BOB },
      { emoji: "🥚", left: 30, bottom: 30, size: 2,   anim: `sim-bob 2.8s 0.4s ease-in-out infinite` },
      { emoji: "🐣", left: 45, bottom: 30, size: 2.3, anim: SWAY },
      { emoji: "🐤", left: 60, bottom: 30, size: 2,   anim: WALK_R },
      { emoji: "🌡️", left: 75, bottom: 31, size: 2,   anim: PULSE },
    ],
    particles: [
      { emoji: "✨", left: 20, delay: 0,   duration: 3, size: "0.8rem" },
      { emoji: "✨", left: 50, delay: 0.8, duration: 3.5, size: "0.8rem" },
      { emoji: "✨", left: 80, delay: 1.5, duration: 3, size: "0.8rem" },
    ],
    label: "🥚 Egg Incubator",
  },

  // ── KITCHEN SCENES ──────────────────────────────────────────────────────────
  "global-kitchen": {
    type: "kitchen",
    sky: "linear-gradient(180deg, #1a0800 0%, #4a1800 45%, #7d3600 100%)",
    horizon: "linear-gradient(180deg, #8b5e3c 0%, #5d3a1a 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#6d4c2a" },
    ],
    characters: [
      { emoji: "👨‍🍳", left: 12, bottom: 28, size: 3,   anim: SWAY },
      { emoji: "🍳",  left: 32, bottom: 32, size: 2.5, anim: BOB },
      { emoji: "🫕",  left: 50, bottom: 32, size: 2.2, anim: `sim-bob 2.2s 0.3s ease-in-out infinite` },
      { emoji: "🔥",  left: 48, bottom: 46, size: 2,   anim: `sim-flame 0.6s ease-in-out infinite` },
      { emoji: "🔥",  left: 30, bottom: 46, size: 1.8, anim: `sim-flame 0.8s 0.2s ease-in-out infinite` },
      { emoji: "🧅",  left: 70, bottom: 29, size: 1.8, anim: BOB },
      { emoji: "🌶️",  left: 80, bottom: 30, size: 1.6, anim: SWAY },
    ],
    particles: [
      { emoji: "💨", left: 35, delay: 0,   duration: 2.5, size: "1rem" },
      { emoji: "💨", left: 55, delay: 0.8, duration: 3,   size: "0.9rem" },
      { emoji: "✨", left: 70, delay: 1.5, duration: 3.5, size: "0.8rem" },
    ],
    activeOverlay: "rgba(255,100,0,0.08)",
    label: "👨‍🍳 Global Kitchen",
  },

  "chocolate-factory": {
    type: "kitchen",
    sky: "linear-gradient(180deg, #1a0c00 0%, #3d1f00 45%, #6b3d00 100%)",
    horizon: "linear-gradient(180deg, #7d5a3c 0%, #4a3520 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#5d4037" },
    ],
    characters: [
      { emoji: "🍫", left: 10, bottom: 30, size: 2.8, anim: BOB },
      { emoji: "🎂", left: 28, bottom: 30, size: 2.5, anim: SWAY },
      { emoji: "🌡️", left: 46, bottom: 31, size: 2.2, anim: PULSE },
      { emoji: "🍮", left: 62, bottom: 30, size: 2,   anim: `sim-bob 2.5s 0.5s ease-in-out infinite` },
      { emoji: "🔥", left: 44, bottom: 44, size: 1.8, anim: `sim-flame 0.7s ease-in-out infinite` },
    ],
    particles: [
      { emoji: "💨", left: 30, delay: 0,   duration: 2.5, size: "1.1rem" },
      { emoji: "💨", left: 50, delay: 1,   duration: 3,   size: "1rem" },
      { emoji: "✨", left: 75, delay: 0.5, duration: 3.5, size: "0.9rem" },
    ],
    activeOverlay: "rgba(180,80,0,0.07)",
    label: "🍫 Chocolate Factory",
  },

  // ── LAB SCENES ──────────────────────────────────────────────────────────────
  "perfume-lab": {
    type: "lab",
    sky: "linear-gradient(180deg, #f3e5f5 0%, #e1bee7 55%, #ce93d8 100%)",
    horizon: "linear-gradient(180deg, #e8d5f5 0%, #c39bd3 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#d7bde2" },
    ],
    characters: [
      { emoji: "🌸", left: 10, bottom: 30, size: 2.5, anim: FLOAT },
      { emoji: "🧪", left: 25, bottom: 32, size: 2.4, anim: BOB },
      { emoji: "🌺", left: 42, bottom: 30, size: 2.2, anim: `sim-bob 3s 0.6s ease-in-out infinite` },
      { emoji: "✨", left: 58, bottom: 34, size: 2,   anim: PULSE },
      { emoji: "🌷", left: 74, bottom: 30, size: 2.2, anim: SWAY },
    ],
    particles: [
      { emoji: "🫧", left: 15, delay: 0,   duration: 4, size: "0.9rem" },
      { emoji: "🫧", left: 48, delay: 1.2, duration: 3.5, size: "0.8rem" },
      { emoji: "💜", left: 82, delay: 0.6, duration: 5, size: "0.8rem" },
    ],
    label: "🌸 Perfume Lab",
  },

  "detergent-lab": {
    type: "lab",
    sky: "linear-gradient(180deg, #e3f2fd 0%, #bbdefb 55%, #90caf9 100%)",
    horizon: "linear-gradient(180deg, #e1f5fe 0%, #81d4fa 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#b3e5fc" },
    ],
    characters: [
      { emoji: "⚗️", left: 12, bottom: 32, size: 2.5, anim: BOB },
      { emoji: "🧪", left: 28, bottom: 32, size: 2.4, anim: `sim-bob 2.2s 0.5s ease-in-out infinite` },
      { emoji: "🫧", left: 44, bottom: 32, size: 2.2, anim: FLOAT },
      { emoji: "🔬", left: 60, bottom: 32, size: 2.2, anim: SWAY },
      { emoji: "💧", left: 76, bottom: 31, size: 2,   anim: PULSE },
    ],
    particles: [
      { emoji: "🫧", left: 20, delay: 0,   duration: 3, size: "0.9rem" },
      { emoji: "🫧", left: 55, delay: 0.7, duration: 3.5, size: "0.8rem" },
      { emoji: "💧", left: 85, delay: 1.5, duration: 4, size: "0.8rem" },
    ],
    label: "⚗️ Detergent Lab",
  },

  "skin-care-lab": {
    type: "lab",
    sky: "linear-gradient(180deg, #fce4ec 0%, #f8bbd0 55%, #f48fb1 100%)",
    horizon: "linear-gradient(180deg, #fce4ec 0%, #f06292 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#f8bbd0" },
    ],
    characters: [
      { emoji: "🌿", left: 10, bottom: 30, size: 2.3, anim: SWAY },
      { emoji: "💎", left: 26, bottom: 32, size: 2.2, anim: PULSE },
      { emoji: "💆‍♀️", left: 42, bottom: 29, size: 2.8, anim: BOB },
      { emoji: "🌸", left: 60, bottom: 30, size: 2.2, anim: FLOAT },
      { emoji: "✨", left: 76, bottom: 33, size: 2,   anim: `sim-bob 2.8s 0.4s ease-in-out infinite` },
    ],
    particles: [
      { emoji: "✨", left: 18, delay: 0,   duration: 3.5, size: "0.8rem" },
      { emoji: "🌺", left: 50, delay: 1,   duration: 4,   size: "0.9rem" },
      { emoji: "💧", left: 80, delay: 0.5, duration: 3,   size: "0.8rem" },
    ],
    label: "✨ Skin Care Lab",
  },

  // ── WORKSHOP SCENES ─────────────────────────────────────────────────────────
  "woodworking": {
    type: "workshop",
    sky: "linear-gradient(180deg, #1a0f00 0%, #3d2400 45%, #6b4a18 100%)",
    horizon: "linear-gradient(180deg, #6d4c2a 0%, #4e342e 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#5d4037" },
    ],
    characters: [
      { emoji: "🪵", left: 10, bottom: 30, size: 2.8, anim: BOB },
      { emoji: "🔨", left: 28, bottom: 31, size: 2.5, anim: SWAY },
      { emoji: "🪚", left: 46, bottom: 31, size: 2.5, anim: `sim-bob 1.8s 0.3s ease-in-out infinite` },
      { emoji: "🌲", left: 64, bottom: 28, size: 3,   anim: SWAY },
      { emoji: "🪑", left: 78, bottom: 29, size: 2.2, anim: BOB },
    ],
    particles: [
      { emoji: "🪵", left: 25, delay: 0,   duration: 3,   size: "0.8rem" },
      { emoji: "🍂", left: 55, delay: 0.8, duration: 3.5, size: "0.8rem" },
      { emoji: "✨", left: 80, delay: 1.5, duration: 4,   size: "0.7rem" },
    ],
    activeOverlay: "rgba(255,180,0,0.05)",
    label: "🪵 Woodworking",
  },

  "hvac-systems": {
    type: "workshop",
    sky: "linear-gradient(180deg, #0d1b2a 0%, #1b3a5c 45%, #2d6a9f 100%)",
    horizon: "linear-gradient(180deg, #546e7a 0%, #37474f 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#455a64" },
    ],
    characters: [
      { emoji: "❄️", left: 10, bottom: 32, size: 2.8, anim: PULSE },
      { emoji: "🌡️", left: 27, bottom: 32, size: 2.5, anim: BOB },
      { emoji: "💨", left: 44, bottom: 32, size: 2.5, anim: WALK_L },
      { emoji: "🔧", left: 60, bottom: 31, size: 2.3, anim: SWAY },
      { emoji: "⚙️", left: 76, bottom: 32, size: 2.3, anim: `sim-spin 4s linear infinite` },
    ],
    particles: [
      { emoji: "❄️", left: 20, delay: 0,   duration: 3.5, size: "0.8rem" },
      { emoji: "💨", left: 50, delay: 0.5, duration: 3,   size: "0.9rem" },
      { emoji: "❄️", left: 80, delay: 1.2, duration: 4,   size: "0.7rem" },
    ],
    label: "❄️ HVAC Systems",
  },

  "aluminum-glazing": {
    type: "workshop",
    sky: "linear-gradient(180deg, #1a237e 0%, #283593 45%, #3949ab 100%)",
    horizon: "linear-gradient(180deg, #607d8b 0%, #37474f 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#546e7a" },
    ],
    characters: [
      { emoji: "🪟", left: 10, bottom: 30, size: 2.8, anim: BOB },
      { emoji: "🔧", left: 28, bottom: 31, size: 2.4, anim: SWAY },
      { emoji: "⚙️", left: 46, bottom: 32, size: 2.3, anim: `sim-spin 3s linear infinite` },
      { emoji: "✨", left: 62, bottom: 34, size: 2.2, anim: PULSE },
      { emoji: "🏗️", left: 76, bottom: 28, size: 2.8, anim: BOB },
    ],
    particles: [
      { emoji: "✨", left: 22, delay: 0,   duration: 2.5, size: "0.9rem" },
      { emoji: "🔩", left: 55, delay: 0.7, duration: 3,   size: "0.8rem" },
      { emoji: "✨", left: 84, delay: 1.3, duration: 3.5, size: "0.7rem" },
    ],
    label: "🪟 Glazing Workshop",
  },

  "solar-energy": {
    type: "workshop",
    sky: "linear-gradient(180deg, #0d47a1 0%, #1565c0 30%, #42a5f5 70%, #fff9c4 100%)",
    horizon: "linear-gradient(180deg, #c8e6c9 0%, #388e3c 100%)",
    structures: [
      { shape: "panel", left: 5,  bottom: 30 },
      { shape: "panel", left: 25, bottom: 30 },
    ],
    characters: [
      { emoji: "☀️", left: 82, bottom: 110, size: 4,   anim: PULSE, zIndex: 0 },
      { emoji: "⚡", left: 20, bottom: 34, size: 2.4, anim: BOB },
      { emoji: "🔋", left: 45, bottom: 32, size: 2.3, anim: `sim-bob 2.5s 0.6s ease-in-out infinite` },
      { emoji: "🌤️", left: 35, bottom: 105, size: 2.4, anim: `sim-drift-r 20s linear infinite`, zIndex: 0 },
    ],
    particles: [
      { emoji: "⚡", left: 15, delay: 0,   duration: 2.5, size: "0.9rem" },
      { emoji: "✨", left: 60, delay: 0.8, duration: 3,   size: "0.8rem" },
      { emoji: "⚡", left: 85, delay: 1.5, duration: 2,   size: "0.7rem" },
    ],
    label: "☀️ Solar Energy",
  },

  // ── ELECTRONICS REPAIR ──────────────────────────────────────────────────────
  "mobile-repair": {
    type: "electronics",
    sky: "linear-gradient(180deg, #0a0a1a 0%, #0d1b2a 50%, #1a2a3a 100%)",
    horizon: "linear-gradient(180deg, #263238 0%, #1c2833 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#2c3e50" },
    ],
    characters: [
      { emoji: "📱", left: 12, bottom: 31, size: 2.6, anim: BOB },
      { emoji: "🔧", left: 28, bottom: 31, size: 2.4, anim: SWAY },
      { emoji: "⚡", left: 44, bottom: 34, size: 2.3, anim: PULSE },
      { emoji: "🔌", left: 60, bottom: 31, size: 2.2, anim: `sim-bob 2.3s 0.4s ease-in-out infinite` },
      { emoji: "🔋", left: 76, bottom: 31, size: 2,   anim: BOB },
    ],
    particles: [
      { emoji: "✨", left: 20, delay: 0,   duration: 2.5, size: "0.8rem" },
      { emoji: "⚡", left: 50, delay: 0.6, duration: 2,   size: "0.8rem" },
      { emoji: "✨", left: 82, delay: 1.2, duration: 3,   size: "0.7rem" },
    ],
    activeOverlay: "rgba(0,200,255,0.04)",
    label: "📱 Mobile Repair",
  },

  "laptop-repair": {
    type: "electronics",
    sky: "linear-gradient(180deg, #0d0d1a 0%, #1a1a2e 50%, #16213e 100%)",
    horizon: "linear-gradient(180deg, #2c3e50 0%, #1c2833 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#263238" },
    ],
    characters: [
      { emoji: "💻", left: 12, bottom: 30, size: 2.8, anim: BOB },
      { emoji: "🔧", left: 30, bottom: 31, size: 2.4, anim: SWAY },
      { emoji: "⚙️", left: 48, bottom: 32, size: 2.3, anim: `sim-spin 4s linear infinite` },
      { emoji: "🖥️", left: 64, bottom: 29, size: 2.6, anim: `sim-bob 3s 0.5s ease-in-out infinite` },
      { emoji: "🖱️", left: 80, bottom: 30, size: 2,   anim: BOB },
    ],
    particles: [
      { emoji: "✨", left: 18, delay: 0,   duration: 3,   size: "0.8rem" },
      { emoji: "⚡", left: 52, delay: 0.8, duration: 2.5, size: "0.8rem" },
      { emoji: "✨", left: 85, delay: 1.4, duration: 3.5, size: "0.7rem" },
    ],
    activeOverlay: "rgba(0,150,255,0.04)",
    label: "💻 Laptop Repair",
  },

  "board-surgeon": {
    type: "electronics",
    sky: "linear-gradient(180deg, #0a1628 0%, #1a2f4a 50%, #1a3a5c 100%)",
    horizon: "linear-gradient(180deg, #1e3a2f 0%, #1a2f1a 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#1e3a2f" },
    ],
    characters: [
      { emoji: "🔌", left: 10, bottom: 31, size: 2.5, anim: BOB },
      { emoji: "🔧", left: 26, bottom: 31, size: 2.4, anim: SWAY },
      { emoji: "💡", left: 42, bottom: 34, size: 2.4, anim: PULSE },
      { emoji: "⚙️", left: 58, bottom: 32, size: 2.3, anim: `sim-spin 3.5s linear infinite` },
      { emoji: "🖥️", left: 74, bottom: 29, size: 2.6, anim: `sim-bob 2.8s 0.4s ease-in-out infinite` },
    ],
    particles: [
      { emoji: "✨", left: 22, delay: 0,   duration: 2, size: "0.8rem" },
      { emoji: "⚡", left: 55, delay: 0.5, duration: 2.5, size: "0.8rem" },
      { emoji: "💡", left: 88, delay: 1.2, duration: 3, size: "0.7rem" },
    ],
    activeOverlay: "rgba(0,255,100,0.04)",
    label: "🔧 Board Surgeon",
  },

  // ── ENTERPRISE SCENES ───────────────────────────────────────────────────────
  "barber-salon": {
    type: "enterprise",
    sky: "linear-gradient(180deg, #2c2c2c 0%, #3d3d3d 45%, #555 100%)",
    horizon: "linear-gradient(180deg, #8d6e63 0%, #6d4c41 100%)",
    structures: [
      { shape: "counter", left: 0, bottom: 28, color: "#5d4037" },
    ],
    characters: [
      { emoji: "✂️", left: 12, bottom: 32, size: 2.5, anim: SWAY },
      { emoji: "💈", left: 28, bottom: 28, size: 2.8, anim: `sim-spin 6s linear infinite` },
      { emoji: "👤", left: 46, bottom: 29, size: 2.6, anim: BOB },
      { emoji: "🪞", left: 64, bottom: 28, size: 2.5, anim: `sim-bob 4s ease-in-out infinite` },
      { emoji: "💇", left: 78, bottom: 29, size: 2.4, anim: SWAY },
    ],
    particles: [
      { emoji: "✂️", left: 20, delay: 0,   duration: 4, size: "0.8rem" },
      { emoji: "💈", left: 58, delay: 1,   duration: 5, size: "0.8rem" },
      { emoji: "✨", left: 86, delay: 0.5, duration: 3, size: "0.7rem" },
    ],
    label: "✂️ Barber Salon",
  },

  "logistics-supply": {
    type: "enterprise",
    sky: "linear-gradient(180deg, #1565c0 0%, #1976d2 40%, #e3f2fd 100%)",
    horizon: "linear-gradient(180deg, #b0bec5 0%, #78909c 100%)",
    structures: [
      { shape: "building", left: 65, bottom: 30, color: "#546e7a" },
    ],
    characters: [
      { emoji: "📦", left: 10, bottom: 31, size: 2.6, anim: BOB },
      { emoji: "🚚", left: 28, bottom: 30, size: 3,   anim: WALK_L },
      { emoji: "✈️", left: 52, bottom: 70, size: 2.8, anim: `sim-drift-r 8s ease-in-out infinite`, zIndex: 2 },
      { emoji: "🚢", left: 68, bottom: 30, size: 2.8, anim: SWAY },
      { emoji: "🗺️", left: 82, bottom: 31, size: 2.2, anim: BOB },
    ],
    particles: [
      { emoji: "📦", left: 15, delay: 0,   duration: 4, size: "0.9rem" },
      { emoji: "📦", left: 50, delay: 1.5, duration: 3.5, size: "0.8rem" },
      { emoji: "✈️", left: 80, delay: 0.8, duration: 5, size: "0.8rem" },
    ],
    label: "📦 Logistics",
  },

  "trade-tycoon": {
    type: "enterprise",
    sky: "linear-gradient(180deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    horizon: "linear-gradient(180deg, #2d5016 0%, #1a3a0a 100%)",
    structures: [
      { shape: "building", left: 62, bottom: 30, color: "#2c5f2e" },
    ],
    characters: [
      { emoji: "📈", left: 10, bottom: 32, size: 2.8, anim: BOB },
      { emoji: "💰", left: 28, bottom: 31, size: 2.6, anim: PULSE },
      { emoji: "🏪", left: 46, bottom: 28, size: 3,   anim: SWAY },
      { emoji: "💹", left: 64, bottom: 32, size: 2.5, anim: `sim-bob 2.5s 0.3s ease-in-out infinite` },
      { emoji: "💎", left: 79, bottom: 32, size: 2.3, anim: FLOAT },
    ],
    particles: [
      { emoji: "💰", left: 18, delay: 0,   duration: 3,   size: "0.9rem" },
      { emoji: "📈", left: 55, delay: 0.8, duration: 4,   size: "0.8rem" },
      { emoji: "🪙", left: 85, delay: 1.5, duration: 3.5, size: "0.8rem" },
    ],
    activeOverlay: "rgba(0,255,100,0.04)",
    label: "📈 Trade Market",
  },

  // ── DIGITAL SCENES ──────────────────────────────────────────────────────────
  "network-noc": {
    type: "digital",
    sky: "linear-gradient(180deg, #000814 0%, #001d3d 45%, #003566 100%)",
    horizon: "linear-gradient(180deg, #001d3d 0%, #000814 100%)",
    structures: [
      { shape: "rack", left: 5,  bottom: 25 },
      { shape: "rack", left: 22, bottom: 25 },
      { shape: "rack", left: 39, bottom: 25 },
    ],
    characters: [
      { emoji: "🌐", left: 60, bottom: 32, size: 2.8, anim: `sim-spin 10s linear infinite` },
      { emoji: "📡", left: 74, bottom: 30, size: 2.6, anim: PULSE },
      { emoji: "⚡", left: 84, bottom: 34, size: 2.2, anim: BOB },
    ],
    particles: [
      { emoji: "📶", left: 20, delay: 0,   duration: 2, size: "0.8rem" },
      { emoji: "⚡", left: 55, delay: 0.5, duration: 2.5, size: "0.8rem" },
      { emoji: "📶", left: 85, delay: 1,   duration: 2, size: "0.7rem" },
    ],
    activeOverlay: "rgba(0,200,255,0.05)",
    label: "🌐 Network NOC",
  },

  "english-journey": {
    type: "digital",
    sky: "linear-gradient(180deg, #1a237e 0%, #283593 40%, #3f51b5 100%)",
    horizon: "linear-gradient(180deg, #5c6bc0 0%, #3949ab 100%)",
    structures: [],
    characters: [
      { emoji: "✈️", left: 10, bottom: 70, size: 3,   anim: `sim-drift-r 12s ease-in-out infinite`, zIndex: 2 },
      { emoji: "🗺️", left: 25, bottom: 30, size: 2.8, anim: BOB },
      { emoji: "📚", left: 44, bottom: 31, size: 2.5, anim: SWAY },
      { emoji: "💬", left: 62, bottom: 34, size: 2.5, anim: FLOAT },
      { emoji: "🌍", left: 78, bottom: 29, size: 2.8, anim: `sim-spin 12s linear infinite` },
    ],
    particles: [
      { emoji: "💬", left: 15, delay: 0,   duration: 4, size: "0.8rem" },
      { emoji: "📖", left: 50, delay: 1,   duration: 4.5, size: "0.9rem" },
      { emoji: "🎯", left: 82, delay: 0.5, duration: 3.5, size: "0.8rem" },
    ],
    label: "✈️ English Journey",
  },

  "music-training": {
    type: "digital",
    sky: "linear-gradient(180deg, #4a148c 0%, #6a1b9a 40%, #8e24aa 100%)",
    horizon: "linear-gradient(180deg, #ad1457 0%, #880e4f 100%)",
    structures: [],
    characters: [
      { emoji: "🎸", left: 10, bottom: 28, size: 3,   anim: SWAY },
      { emoji: "🎹", left: 28, bottom: 28, size: 3,   anim: BOB },
      { emoji: "🎵", left: 48, bottom: 38, size: 2.5, anim: FLOAT },
      { emoji: "🎤", left: 64, bottom: 30, size: 2.6, anim: `sim-bob 2s 0.3s ease-in-out infinite` },
      { emoji: "🎼", left: 78, bottom: 30, size: 2.5, anim: SWAY },
    ],
    particles: [
      { emoji: "🎵", left: 18, delay: 0,   duration: 3.5, size: "1rem" },
      { emoji: "🎶", left: 50, delay: 0.8, duration: 4,   size: "0.9rem" },
      { emoji: "🎵", left: 82, delay: 1.5, duration: 3,   size: "0.8rem" },
    ],
    label: "🎵 Music Academy",
  },
};

// ── Structure renderers ──────────────────────────────────────────────────────

function renderStructure(s: StructureDef, i: number) {
  const key = `struct-${i}`;
  const color = s.color ?? "#795548";
  const scale = s.scale ?? 1;

  if (s.shape === "barn") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        {/* Roof */}
        <div style={{
          width: 52 * scale, height: 0,
          borderLeft: `${26 * scale}px solid transparent`,
          borderRight: `${26 * scale}px solid transparent`,
          borderBottom: `${22 * scale}px solid #7d2100`,
          marginBottom: -1,
        }} />
        {/* Body */}
        <div style={{
          width: 52 * scale, height: 38 * scale,
          background: color,
          borderRadius: "0 0 3px 3px",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 14 * scale, height: 18 * scale, background: "rgba(0,0,0,0.4)", borderRadius: 2 }} />
        </div>
      </div>
    );
  }

  if (s.shape === "tree") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: "16px solid transparent",
          borderRight: "16px solid transparent",
          borderBottom: "32px solid #2e7d32",
          marginBottom: -2,
        }} />
        <div style={{
          width: 0, height: 0,
          borderLeft: "22px solid transparent",
          borderRight: "22px solid transparent",
          borderBottom: "38px solid #388e3c",
          marginBottom: -2, marginLeft: -6,
        }} />
        <div style={{ width: 8, height: 18, background: "#5d4037", margin: "0 auto" }} />
      </div>
    );
  }

  if (s.shape === "tank") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        <div style={{
          width: 28, height: 40,
          background: color,
          borderRadius: "50% 50% 5px 5px / 20% 20% 5px 5px",
          border: "2px solid rgba(255,255,255,0.2)",
        }} />
      </div>
    );
  }

  if (s.shape === "counter") {
    return (
      <div key={key} style={{
        position: "absolute", left: 0, right: 0, bottom: s.bottom,
        height: 28, background: color, zIndex: 1,
        borderTop: "3px solid rgba(255,255,255,0.15)",
      }} />
    );
  }

  if (s.shape === "rack") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        <div style={{
          width: 34, height: 80,
          background: "#1a2a3a",
          border: "1px solid #00bcd4",
          borderRadius: 3,
          padding: "4px 2px",
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          {[0,1,2,3,4].map(j => (
            <div key={j} style={{
              height: 10,
              background: "#0d1b2a",
              borderRadius: 2,
              border: "1px solid #00acc1",
              display: "flex", alignItems: "center", paddingLeft: 3, gap: 3,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: j % 2 === 0 ? "#00e676" : "#00b0ff", animation: `sim-blink ${1.5 + j * 0.3}s step-end infinite` }} />
              <div style={{ flex: 1, height: 2, background: "#00acc1", opacity: 0.3 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (s.shape === "panel") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        <div style={{
          width: 60, height: 40,
          background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
          border: "2px solid #42a5f5",
          borderRadius: 4,
          transform: "perspective(80px) rotateX(20deg)",
          display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 2, padding: 4,
        }}>
          {[...Array(6)].map((_,j) => (
            <div key={j} style={{ background: "#1976d2", borderRadius: 1, border: "1px solid #42a5f5", opacity: 0.8 }} />
          ))}
        </div>
        <div style={{ width: 4, height: 14, background: "#546e7a", margin: "0 auto" }} />
      </div>
    );
  }

  if (s.shape === "building") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, bottom: s.bottom, zIndex: 1 }}>
        <div style={{
          width: 44, height: 60,
          background: color,
          borderRadius: "3px 3px 0 0",
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gridTemplateRows: "repeat(4,1fr)",
          gap: 3, padding: 5,
        }}>
          {[...Array(12)].map((_,j) => (
            <div key={j} style={{
              background: Math.random() > 0.4 ? "#ffd54f" : "rgba(0,0,0,0.3)",
              borderRadius: 1,
              animation: `sim-blink ${2 + (j % 3) * 0.8}s ${j * 0.2}s step-end infinite`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (s.shape === "fence") {
    return (
      <div key={key} style={{ position: "absolute", left: `${s.left}%`, right: "35%", bottom: s.bottom, zIndex: 1, height: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
        {[...Array(8)].map((_,j) => (
          <div key={j} style={{ width: 4, height: j % 3 === 0 ? 18 : 14, background: "#795548", borderRadius: 1 }} />
        ))}
      </div>
    );
  }

  return null;
}

// ── Cloud component ──────────────────────────────────────────────────────────

function Cloud({ top, left, scale = 1, speed = 24 }: { top: number; left: number; scale?: number; speed?: number }) {
  return (
    <div style={{
      position: "absolute", top, left: `${left}%`, zIndex: 0,
      animation: `sim-drift-r ${speed}s linear infinite`,
      opacity: 0.7,
    }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div style={{ width: 50 * scale, height: 18 * scale, background: "rgba(255,255,255,0.85)", borderRadius: 50, filter: "blur(1px)" }} />
        <div style={{ position: "absolute", top: -8 * scale, left: 8 * scale, width: 28 * scale, height: 22 * scale, background: "rgba(255,255,255,0.85)", borderRadius: "50%", filter: "blur(1px)" }} />
        <div style={{ position: "absolute", top: -5 * scale, left: 20 * scale, width: 22 * scale, height: 18 * scale, background: "rgba(255,255,255,0.85)", borderRadius: "50%", filter: "blur(1px)" }} />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  slug: string;
  isActive?: boolean;
  isComplete?: boolean;
}

export function SimulationScene({ slug, isActive = false, isComplete = false }: Props) {
  const scene = SCENES[slug] ?? SCENES["global-kitchen"];
  const isFarm = scene.type === "farm";
  const isKitchen = scene.type === "kitchen";
  const isElectronics = scene.type === "electronics";
  const isDigital = scene.type === "digital";
  const isNoc = slug === "network-noc";

  useAmbientSound(isActive ? getSimulationAmbient(slug) : null);

  // Celebration particles on complete
  const [showCelebration, setShowCelebration] = useState(false);
  const prevComplete = useRef(false);
  useEffect(() => {
    if (isComplete && !prevComplete.current) {
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 4000);
      prevComplete.current = true;
      return () => clearTimeout(t);
    }
    if (!isComplete) prevComplete.current = false;
  }, [isComplete]);

  return (
    <div
      className="relative w-full overflow-hidden mb-5 select-none"
      style={{
        height: 170,
        borderRadius: 16,
        transition: "filter 0.5s",
        filter: !isActive && !isComplete ? "brightness(0.85) saturate(0.8)" : "brightness(1) saturate(1)",
      }}
      aria-hidden="true"
    >
      {/* Sky / Background */}
      <div style={{ position: "absolute", inset: 0, background: scene.sky }} />

      {/* Clouds (farm, kitchen, enterprise, digital) */}
      {(isFarm || isDigital) && (
        <>
          <Cloud top={12} left={8}  scale={0.9} speed={22} />
          <Cloud top={6}  left={40} scale={1.1} speed={30} />
          <Cloud top={18} left={68} scale={0.7} speed={18} />
        </>
      )}

      {/* Ground / Floor */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: isFarm ? 55 : isKitchen || isElectronics || isNoc ? 38 : 40,
        background: scene.horizon,
      }} />

      {/* NOC grid overlay */}
      {isNoc && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(rgba(0,188,212,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(0,188,212,0.07) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }} />
      )}

      {/* Structures */}
      {scene.structures.map((s, i) => renderStructure(s, i))}

      {/* Characters */}
      {scene.characters.map((c, i) => (
        <span key={`char-${i}`} style={{
          position: "absolute",
          left: `${c.left}%`,
          bottom: c.bottom,
          fontSize: `${c.size}rem`,
          zIndex: c.zIndex ?? 2,
          animation: isActive ? c.anim : c.anim.replace(/(\d+\.?\d*)s/, (m, d) => `${parseFloat(d) * 1.8}s`),
          filter: isActive ? "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" : "none",
          transition: "filter 0.5s",
        }}>
          {c.emoji}
        </span>
      ))}

      {/* Floating particles */}
      {scene.particles.map((p, i) => (
        <span key={`part-${i}`} style={{
          position: "absolute",
          left: `${p.left}%`,
          bottom: 20,
          fontSize: p.size,
          zIndex: 3,
          opacity: isActive ? 0.9 : 0.4,
          animation: `sim-drift-up ${p.duration}s ${p.delay}s ease-in-out infinite`,
          transition: "opacity 0.5s",
        }}>
          {p.emoji}
        </span>
      ))}

      {/* Active overlay tint */}
      {scene.activeOverlay && isActive && (
        <div style={{ position: "absolute", inset: 0, background: scene.activeOverlay, zIndex: 4 }} />
      )}

      {/* Complete overlay */}
      {isComplete && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          background: "linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(0,200,100,0.12) 100%)",
        }} />
      )}

      {/* Celebration confetti */}
      {showCelebration && ["🎉","⭐","🌟","🎊","✨","🏆","⭐","🎉","✨","🌟"].map((e, i) => (
        <span key={`cel-${i}`} style={{
          position: "absolute",
          left: `${i * 10 + 3}%`,
          top: "50%",
          fontSize: "1.4rem",
          zIndex: 6,
          animation: `sim-celebrate ${1.5 + (i % 3) * 0.4}s ${i * 0.15}s ease-out forwards`,
        }}>
          {e}
        </span>
      ))}

      {/* Bottom label bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 32, zIndex: 7,
        background: "linear-gradient(0deg,rgba(0,0,0,0.55) 0%,transparent 100%)",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        padding: "0 12px 6px",
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {scene.label}
        </span>
        {isComplete && <span style={{ color: "#ffd700", fontSize: "0.75rem", fontWeight: 700 }}>🏆 Complete!</span>}
        {isActive && !isComplete && <span style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.7rem" }}>● Live</span>}
      </div>
    </div>
  );
}
