/**
 * Official iframe players the Library may embed, and nothing else.
 *
 * Adapters build embed URLs from a provider's item id, never from a URL the
 * provider returned, and the page checks every embed against this list again
 * before rendering an iframe. Shared by the server and the web app.
 */

const EMBED_RULES: ReadonlyArray<{ host: string; path: RegExp }> = [
  { host: "archive.org", path: /^\/embed\/[A-Za-z0-9._-]+$/ },
  { host: "www.youtube-nocookie.com", path: /^\/embed\/[A-Za-z0-9_-]{11}$/ },
  { host: "player.vimeo.com", path: /^\/video\/\d+$/ },
  { host: "www.dailymotion.com", path: /^\/embed\/video\/[A-Za-z0-9]+$/ },
  { host: "books.google.com", path: /^\/books$/ },
];

export function isAllowedEmbed(value: string | null | undefined): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  return EMBED_RULES.some((rule) => rule.host === url.hostname && rule.path.test(url.pathname));
}

const SAFE_ID = /^[A-Za-z0-9._-]{1,120}$/;

export const embeds = {
  archive: (identifier: string) => SAFE_ID.test(identifier) ? `https://archive.org/embed/${identifier}` : null,
  youtube: (videoId: string) => /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null,
  vimeo: (videoId: string) => /^\d{1,15}$/.test(videoId) ? `https://player.vimeo.com/video/${videoId}` : null,
  dailymotion: (videoId: string) => /^[A-Za-z0-9]{1,20}$/.test(videoId) ? `https://www.dailymotion.com/embed/video/${videoId}` : null,
  googleBooks: (volumeId: string) => /^[A-Za-z0-9_-]{1,20}$/.test(volumeId) ? `https://books.google.com/books?id=${volumeId}&output=embed` : null,
};
