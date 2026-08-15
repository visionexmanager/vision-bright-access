/** Classifies a stream URL so the player picks the right surface. */
export type UrlType = "youtube" | "hls" | "audio" | "external";

export function detectType(url: string): UrlType {
  if (!url) return "external";

  // YouTube
  if (url.includes("youtube.com/embed") || url.includes("youtu.be")) return "youtube";

  // Audio — checked before HLS so audio streams with .m3u8 playlists still
  // render with the radio UI rather than the TV video player.
  if (
    url.match(/\.(mp3|aac|ogg|opus|flac|wav)(\?|$)/i) ||
    url.includes("icecast") || url.includes("shoutcast") ||
    url.includes("radiojar") || url.includes("zeno.fm") ||
    url.includes("infomaniak") || url.includes("bbcmedia") ||
    url.includes("zenapi") || url.includes("lstn.lv") ||
    url.includes("streamtheworld") || url.includes("sslstream") ||
    url.includes("stream.srg-ssr")
  ) return "audio";

  // HLS — only match explicit .m3u8 extension or the hls path segment
  // "/hls/" or "hls/" to avoid false positives on hostnames that contain "hls"
  if (
    url.match(/\.m3u8(\?|$)/i) ||
    url.match(/[/?]hls[/?]/i) ||
    url.endsWith("/hls")
  ) return "hls";

  return "external";
}
