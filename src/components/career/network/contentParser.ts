export interface ContentSegment {
  type: "text" | "hashtag" | "mention";
  value: string;
}

const TOKEN_PATTERN = /([#@][A-Za-z0-9_]+)/g;

export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, index) });
    }
    const token = match[0];
    segments.push({ type: token.startsWith("#") ? "hashtag" : "mention", value: token });
    lastIndex = index + token.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
