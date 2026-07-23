import type { LibraryKgEntityType } from "@/services/library/knowledgeGraph";

/**
 * Fixed entity_type -> color mapping (identity encoding, never cycled) so an
 * entity's color stays stable across every graph it appears in, per the
 * dataviz categorical-color rule.
 */
export const KG_ENTITY_TYPE_COLORS: Record<LibraryKgEntityType, { fill: string; text: string; badge: string }> = {
  author: { fill: "#3b82f6", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  topic: { fill: "#8b5cf6", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  character: { fill: "#ec4899", text: "text-pink-600 dark:text-pink-400", badge: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  historical_event: { fill: "#f59e0b", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  scientific_concept: { fill: "#10b981", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  location: { fill: "#06b6d4", text: "text-cyan-600 dark:text-cyan-400", badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  organization: { fill: "#f97316", text: "text-orange-600 dark:text-orange-400", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  person: { fill: "#64748b", text: "text-slate-600 dark:text-slate-400", badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  technology: { fill: "#6366f1", text: "text-indigo-600 dark:text-indigo-400", badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  language: { fill: "#14b8a6", text: "text-teal-600 dark:text-teal-400", badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300" },
  skill: { fill: "#e11d48", text: "text-rose-600 dark:text-rose-400", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  publisher: { fill: "#65a30d", text: "text-lime-700 dark:text-lime-400", badge: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
};
