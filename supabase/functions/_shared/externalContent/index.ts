/**
 * External content providers — the public surface. See registry.ts for the
 * list, aggregate.ts for search, and types.ts for the normalised item.
 */

export * from "./types.ts";
export { isAllowedEmbed } from "./embed.ts";
export { CONTENT_PROVIDERS, UNSUPPORTED_PROVIDERS, providerById, providerStatus, summarizeProviders } from "./registry.ts";
export {
  checkAllProviders, checkProviderHealth, normalizeSearchInput, resolveExternalItem, ResultCache, searchExternalContent,
  type NormalizedInput, type SearchInput,
} from "./aggregate.ts";
export {
  YouTubeError, classifyGoogleError, getYouTubeResource, isYouTubeResourceUrl, normalizeYouTubeSearch, searchYouTube, splitYouTubeItemId,
  youtubeErrorResponse, youtubeStats,
} from "./youtube.ts";
