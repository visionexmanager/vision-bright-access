export type KidsColor = "primary" | "secondary" | "accent" | "pink" | "green" | "purple";

export type PluginCategory =
  | "game" | "story" | "course" | "ai-tool" | "theme" | "language" | "widget" | "integration" | "core";

export interface Plugin {
  slug: string;
  name: string;
  summary: string | null;
  emoji: string;
  category: PluginCategory;
  entry: string;
  author: string;
  license: string;
  permissions: string[];
  dependencies: string[];
  routes: string[];
  manifest: Record<string, unknown>;
  is_core: boolean;
  color: KidsColor;
  order_index: number;
  status: "published" | "draft";
  created_at: string;
}

export interface PluginVersion {
  id: string;
  plugin_slug: string;
  version: string;
  changelog: string | null;
  is_current: boolean;
  released_at: string;
}

export interface PluginInstall {
  user_id: string;
  plugin_slug: string;
  enabled: boolean;
  granted_permissions: string[];
  settings: Record<string, unknown>;
  installed_at: string;
  updated_at: string;
}

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetDef {
  slug: string;
  name: string;
  emoji: string;
  entry: string;
  size: WidgetSize;
  needs_auth: boolean;
  order_index: number;
  status: "published" | "draft";
}

export interface DashboardWidget {
  user_id: string;
  widget_slug: string;
  position: number;
  enabled: boolean;
  updated_at: string;
}

export type ThemeVariant = "light" | "dark" | "high-contrast";

export interface Theme {
  slug: string;
  name: string;
  emoji: string;
  variant: ThemeVariant;
  data_theme: string;
  is_seasonal: boolean;
  order_index: number;
  status: "published" | "draft";
}

export type NotificationChannel = "in-app" | "push" | "email" | "sms" | "scheduled";

export interface KidsNotification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  emoji: string;
  channel: NotificationChannel;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface PlatformStats {
  installed: number;
  widgets: number;
  unread: number;
  theme: string;
}

/** A platform "engine" — a core capability surfaced in the Platform Hub. */
export type EngineStatus = "core" | "active" | "extensible";

export interface EngineInfo {
  id: string;
  labelKey: string;
  emoji: string;
  status: EngineStatus;
}
