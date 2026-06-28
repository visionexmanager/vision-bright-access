/**
 * M3U playlist parser
 *
 * Parses standard Extended M3U format:
 *   #EXTM3U
 *   #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Display Name
 *   http://stream.example.com/channel.m3u8
 *
 * Also handles bare M3U (no #EXTINF, just URLs).
 */

export type M3UChannel = {
  name:    string;
  logo:    string;
  group:   string;
  url:     string;
  tvgId:   string;
  tvgName: string;
  language: string;
};

function attr(line: string, key: string): string {
  const m = line.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1].trim() : "";
}

export function parseM3U(content: string): M3UChannel[] {
  const lines    = content.split(/\r?\n/);
  const channels: M3UChannel[] = [];
  let current: Partial<M3UChannel> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const tvgId    = attr(line, "tvg-id");
      const tvgName  = attr(line, "tvg-name");
      const logo     = attr(line, "tvg-logo");
      const group    = attr(line, "group-title") || "General";
      const language = attr(line, "tvg-language") || attr(line, "tvg-lang") || "";
      // Display name is after the last comma
      const comma = line.lastIndexOf(",");
      const name  = comma >= 0 ? line.slice(comma + 1).trim() : (tvgName || "Unknown");
      current = { name, logo, group, tvgId, tvgName, url: "", language };
      continue;
    }

    // Skip other directive lines
    if (line.startsWith("#")) continue;

    // This is a URL — pair with pending current or create a bare entry
    if (current) {
      channels.push({ ...current, url: line } as M3UChannel);
      current = null;
    } else {
      // Bare URL with no preceding #EXTINF
      channels.push({
        name: line.split("/").pop() ?? "Stream",
        logo: "", group: "General", tvgId: "", tvgName: "", url: line, language: "",
      });
    }
  }

  return channels;
}

export function countM3UChannels(content: string): number {
  return (content.match(/#EXTINF/gi) ?? []).length;
}

export type M3UGroup = {
  name:     string;
  channels: M3UChannel[];
};

export function groupM3UChannels(channels: M3UChannel[]): M3UGroup[] {
  const map = new Map<string, M3UChannel[]>();
  for (const ch of channels) {
    const g = ch.group || "General";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(ch);
  }
  return Array.from(map.entries()).map(([name, chs]) => ({ name, channels: chs }));
}
