import type { KidsColor, EngineInfo } from "@/features/visionkids/types/platform.types";

export const PLATFORM_COLOR_CLASSES: Record<KidsColor, string> = {
  primary: "border-kids-primary/30 bg-kids-primary/10 text-kids-primary",
  secondary: "border-kids-secondary/30 bg-kids-secondary/10 text-kids-secondary",
  accent: "border-kids-accent/30 bg-kids-accent/10 text-kids-accent",
  pink: "border-kids-pink/30 bg-kids-pink/10 text-kids-pink",
  green: "border-kids-green/30 bg-kids-green/10 text-kids-green",
  purple: "border-kids-purple/30 bg-kids-purple/10 text-kids-purple",
};

/** The Core Platform engines. `status`:
 *   'core'       — already fully implemented elsewhere in the app,
 *   'active'     — implemented by this phase (plugin/widget/theme/notification),
 *   'extensible' — a defined extension point wired to real features but open for
 *                  future providers (semantic AI search, push workers, etc.).
 *  This registry is what the Platform Hub renders; adding an engine is one row. */
export const PLATFORM_ENGINES: EngineInfo[] = [
  { id: "auth", labelKey: "kids.platform.engine.auth", emoji: "🔑", status: "core" },
  { id: "authz", labelKey: "kids.platform.engine.authz", emoji: "🛂", status: "core" },
  { id: "routing", labelKey: "kids.platform.engine.routing", emoji: "🧭", status: "core" },
  { id: "permissions", labelKey: "kids.platform.engine.permissions", emoji: "🔐", status: "active" },
  { id: "settings", labelKey: "kids.platform.engine.settings", emoji: "⚙️", status: "core" },
  { id: "localization", labelKey: "kids.platform.engine.localization", emoji: "🌐", status: "core" },
  { id: "accessibility", labelKey: "kids.platform.engine.accessibility", emoji: "♿", status: "core" },
  { id: "theme", labelKey: "kids.platform.engine.theme", emoji: "🎨", status: "active" },
  { id: "notification", labelKey: "kids.platform.engine.notification", emoji: "🔔", status: "active" },
  { id: "search", labelKey: "kids.platform.engine.search", emoji: "🔍", status: "extensible" },
  { id: "analytics", labelKey: "kids.platform.engine.analytics", emoji: "📊", status: "active" },
  { id: "ai", labelKey: "kids.platform.engine.ai", emoji: "🤖", status: "extensible" },
  { id: "media", labelKey: "kids.platform.engine.media", emoji: "🖼️", status: "extensible" },
  { id: "plugin", labelKey: "kids.platform.engine.plugin", emoji: "🧩", status: "active" },
];

/** Plugin marketplace category tabs. */
export const PLUGIN_CATEGORIES = [
  "all", "game", "story", "course", "ai-tool", "theme", "language", "widget", "integration",
] as const;

/** The six settings audiences (role-scoped settings surfaces). */
export const SETTINGS_ROLES = ["child", "parent", "teacher", "school", "creator", "admin"] as const;
