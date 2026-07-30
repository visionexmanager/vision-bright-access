import type { Plugin } from "@/features/visionkids/types/platform.types";

/**
 * The canonical plugin manifest shape (stored in kids_plugins.manifest JSONB).
 * A manifest is fully declarative — the client never runs uploaded code; it
 * resolves `entry` to a built-in module and grants the declared permissions.
 */
export interface PluginManifest {
  id: string;
  version: string;
  author: string;
  license: string;
  description?: string;
  entry: string;
  permissions: string[];
  dependencies: string[];
  routes: string[];
  assets?: string[];
  localization?: string[];
  settingsSchema?: Record<string, unknown>;
}

/**
 * Resolve a plugin's `entry` to an in-app destination.
 *   'section:<slug>' → the core feature route /kids/<slug>
 *   'ext:<name>'     → an installable extension (surfaced on the plugin page)
 * Returns null when a plugin has no navigable destination (e.g. a theme/lang
 * pack that only changes settings once installed).
 */
export function resolvePluginRoute(plugin: Plugin): string | null {
  if (plugin.entry.startsWith("section:")) {
    return `/kids/${plugin.entry.slice("section:".length)}`;
  }
  return null;
}

/** True when a plugin adds a navigable feature (core sections do). */
export function isNavigablePlugin(plugin: Plugin): boolean {
  return resolvePluginRoute(plugin) !== null;
}

/** Build a manifest object from a catalog row (for the details panel). */
export function toManifest(plugin: Plugin, version: string): PluginManifest {
  return {
    id: plugin.slug,
    version,
    author: plugin.author,
    license: plugin.license,
    description: plugin.summary ?? undefined,
    entry: plugin.entry,
    permissions: plugin.permissions,
    dependencies: plugin.dependencies,
    routes: plugin.routes,
  };
}
