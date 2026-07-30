import type { KidsColor, ScienceRank, InventorRank } from "@/features/visionkids/types/stem.types";

export const STEM_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

export interface ConceptTab {
  value: string;
  labelKey: string;
}

/** Concept (topic) tabs per lab. `all` is prepended by the template. Labels come
 *  from kids.stem.topic.<slug>. Adding a concept here is data-only; the generic
 *  LabExperimentsPage renders whatever tabs a lab lists. */
export const LAB_CONCEPTS: Record<string, ConceptTab[]> = {
  science: [
    { value: "matter", labelKey: "kids.stem.topic.matter" },
    { value: "forces", labelKey: "kids.stem.topic.forces" },
    { value: "living", labelKey: "kids.stem.topic.living" },
    { value: "earth", labelKey: "kids.stem.topic.earth" },
    { value: "energy", labelKey: "kids.stem.topic.energy" },
  ],
  physics: [
    { value: "force", labelKey: "kids.stem.topic.force" },
    { value: "motion", labelKey: "kids.stem.topic.motion" },
    { value: "energy", labelKey: "kids.stem.topic.energy" },
    { value: "gravity", labelKey: "kids.stem.topic.gravity" },
    { value: "light", labelKey: "kids.stem.topic.light" },
    { value: "sound", labelKey: "kids.stem.topic.sound" },
    { value: "magnetism", labelKey: "kids.stem.topic.magnetism" },
  ],
  chemistry: [
    { value: "elements", labelKey: "kids.stem.topic.elements" },
    { value: "solutions", labelKey: "kids.stem.topic.solutions" },
    { value: "reactions", labelKey: "kids.stem.topic.reactions" },
    { value: "acids_bases", labelKey: "kids.stem.topic.acidsBases" },
    { value: "water_cycle", labelKey: "kids.stem.topic.waterCycle" },
  ],
  biology: [
    { value: "animals", labelKey: "kids.stem.topic.animals" },
    { value: "plants", labelKey: "kids.stem.topic.plants" },
    { value: "cells", labelKey: "kids.stem.topic.cells" },
    { value: "human_body", labelKey: "kids.stem.topic.humanBody" },
    { value: "food_chains", labelKey: "kids.stem.topic.foodChains" },
    { value: "environment", labelKey: "kids.stem.topic.environment" },
  ],
  math: [
    { value: "add", labelKey: "kids.stem.topic.add" },
    { value: "subtract", labelKey: "kids.stem.topic.subtract" },
    { value: "multiply", labelKey: "kids.stem.topic.multiply" },
    { value: "divide", labelKey: "kids.stem.topic.divide" },
    { value: "fractions", labelKey: "kids.stem.topic.fractions" },
    { value: "geometry", labelKey: "kids.stem.topic.geometry" },
    { value: "measurement", labelKey: "kids.stem.topic.measurement" },
    { value: "statistics", labelKey: "kids.stem.topic.statistics" },
  ],
  engineering: [
    { value: "bridges", labelKey: "kids.stem.topic.bridges" },
    { value: "towers", labelKey: "kids.stem.topic.towers" },
    { value: "cars", labelKey: "kids.stem.topic.cars" },
    { value: "houses", labelKey: "kids.stem.topic.houses" },
  ],
  electronics: [
    { value: "batteries", labelKey: "kids.stem.topic.batteries" },
    { value: "circuits", labelKey: "kids.stem.topic.circuits" },
    { value: "bulbs", labelKey: "kids.stem.topic.bulbs" },
    { value: "switches", labelKey: "kids.stem.topic.switches" },
    { value: "sensors", labelKey: "kids.stem.topic.sensors" },
    { value: "solar", labelKey: "kids.stem.topic.solar" },
  ],
  space: [
    { value: "rockets", labelKey: "kids.stem.topic.rockets" },
    { value: "orbits", labelKey: "kids.stem.topic.orbits" },
    { value: "missions", labelKey: "kids.stem.topic.missions" },
    { value: "planets", labelKey: "kids.stem.topic.planets" },
  ],
};

/** The 8 generic-list labs (each rendered by LabExperimentsPage via a thin
 *  wrapper page). Robotics / 3D / Innovation / Gallery / Research are bespoke. */
export interface LabPageConfig {
  slug: string;
  emoji: string;
  canonicalPath: string;
}

export const GENERIC_LABS: Record<string, LabPageConfig> = {
  science: { slug: "science", emoji: "🔬", canonicalPath: "/kids/stem/science" },
  physics: { slug: "physics", emoji: "🧲", canonicalPath: "/kids/stem/physics" },
  chemistry: { slug: "chemistry", emoji: "⚗️", canonicalPath: "/kids/stem/chemistry" },
  biology: { slug: "biology", emoji: "🧬", canonicalPath: "/kids/stem/biology" },
  math: { slug: "math", emoji: "➗", canonicalPath: "/kids/stem/math" },
  engineering: { slug: "engineering", emoji: "🏗️", canonicalPath: "/kids/stem/engineering" },
  electronics: { slug: "electronics", emoji: "💡", canonicalPath: "/kids/stem/electronics" },
  space: { slug: "space", emoji: "🚀", canonicalPath: "/kids/stem/space" },
};

export const SCIENCE_RANKS: { slug: ScienceRank; emoji: string }[] = [
  { slug: "novice", emoji: "🌱" },
  { slug: "explorer", emoji: "🔎" },
  { slug: "researcher", emoji: "📗" },
  { slug: "scientist", emoji: "🔬" },
  { slug: "professor", emoji: "🎓" },
];

export const INVENTOR_RANKS: { slug: InventorRank; emoji: string }[] = [
  { slug: "tinkerer", emoji: "🔧" },
  { slug: "builder", emoji: "🧱" },
  { slug: "maker", emoji: "🛠️" },
  { slug: "innovator", emoji: "💡" },
  { slug: "genius", emoji: "🧠" },
];

export const SCIENCE_RANK_EMOJI: Record<string, string> = Object.fromEntries(
  SCIENCE_RANKS.map((r) => [r.slug, r.emoji]),
);
export const INVENTOR_RANK_EMOJI: Record<string, string> = Object.fromEntries(
  INVENTOR_RANKS.map((r) => [r.slug, r.emoji]),
);

/** The 5 phases of an Innovation Challenge (guided client-side). */
export const INNOVATION_PHASES = ["problem", "idea", "solution", "prototype", "present"] as const;
export type InnovationPhase = (typeof INNOVATION_PHASES)[number];

export const INNOVATION_PHASE_EMOJI: Record<InnovationPhase, string> = {
  problem: "❓",
  idea: "💭",
  solution: "✨",
  prototype: "🛠️",
  present: "🎤",
};

/** Robotics Workshop — the command palette for the virtual robot. */
export const ROBOT_COMMANDS = ["forward", "left", "right", "sense", "pickup"] as const;
export type RobotCommand = (typeof ROBOT_COMMANDS)[number];

export const ROBOT_COMMAND_META: Record<RobotCommand, { emoji: string; labelKey: string }> = {
  forward: { emoji: "⬆️", labelKey: "kids.stem.robotics.cmd.forward" },
  left: { emoji: "↩️", labelKey: "kids.stem.robotics.cmd.left" },
  right: { emoji: "↪️", labelKey: "kids.stem.robotics.cmd.right" },
  sense: { emoji: "📡", labelKey: "kids.stem.robotics.cmd.sense" },
  pickup: { emoji: "🤏", labelKey: "kids.stem.robotics.cmd.pickup" },
};

/** 3D Design Studio — starter templates and the parts/colors a child can tweak. */
export interface DesignTemplate {
  slug: string;
  emoji: string;
  labelKey: string;
}

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  { slug: "house", emoji: "🏠", labelKey: "kids.stem.design.template.house" },
  { slug: "car", emoji: "🚗", labelKey: "kids.stem.design.template.car" },
  { slug: "character", emoji: "🤖", labelKey: "kids.stem.design.template.character" },
  { slug: "toy", emoji: "🧸", labelKey: "kids.stem.design.template.toy" },
];

export const DESIGN_COLORS: { slug: string; value: string }[] = [
  { slug: "red", value: "#ef4444" },
  { slug: "orange", value: "#f97316" },
  { slug: "yellow", value: "#eab308" },
  { slug: "green", value: "#22c55e" },
  { slug: "blue", value: "#3b82f6" },
  { slug: "purple", value: "#a855f7" },
  { slug: "pink", value: "#ec4899" },
];
