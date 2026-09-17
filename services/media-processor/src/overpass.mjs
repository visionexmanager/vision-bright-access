// "What is near me", relayed from this server.
//
// overpass-api.de answers 406 to every request from Supabase's Edge Function
// network (health-check shows it on every run), while the same query from an
// ordinary server answers in about a second. So the assistant asks from here.
//
// This is not an open proxy. A query is accepted only if it is the shape the
// assistant sends: JSON output, a short timeout, and every statement bounded by
// `around:` a coordinate within a few kilometres. Anything else is refused
// before a request leaves the box.
//
// Zero dependencies, like the rest of this service.

export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const MAX_QUERY_CHARS = 2_000;
export const MAX_RADIUS_M = 5_000;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
export const RELAY_TIMEOUT_MS = 12_000;
const USER_AGENT = "VisionexAssistant/1.0 (+https://visionex.app; support@visionex.app)";

/**
 * Whether a query is one the assistant would send.
 *
 * Returns a reason when it is not, so the refusal can be logged by kind.
 */
export function checkOverpassQuery(query) {
  if (typeof query !== "string" || !query.trim()) return "missing_query";
  if (query.length > MAX_QUERY_CHARS) return "query_too_long";
  if (!/^\[out:json\]\[timeout:(\d{1,2})\];/.test(query)) return "bad_header";
  const timeout = Number(/^\[out:json\]\[timeout:(\d{1,2})\];/.exec(query)[1]);
  if (timeout > 15) return "timeout_too_long";
  // Output formats, recursion over the whole planet, and area searches are the
  // expensive shapes. The assistant uses none of them.
  if (/\[out:(?!json)|\bmap_to_area\b|\barea\s*\[|\bis_in\b|\(\s*\*\s*\)|\bconvert\b|\bmake\b|\bforeach\b|\brecurse\b|<|>/.test(query)) {
    return "disallowed_statement";
  }
  // Every element statement, with or without a filter in brackets — `way["x"]`
  // with no `around:` is the unbounded shape this check exists to stop.
  const statements = query.match(/\b(?:nwr|nw|nr|wr|node|way|rel|relation)\b/g) ?? [];
  if (statements.length === 0 || statements.length > 12) return "bad_statements";
  const bounded = query.match(/\b(?:nwr|node|way|relation)\(around:(\d{1,7}),(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)\)/g) ?? [];
  if (bounded.length !== statements.length) return "unbounded_statement";
  for (const statement of bounded) {
    const [, radius, lat, lon] = /around:(\d{1,7}),(-?[\d.]+),(-?[\d.]+)/.exec(statement);
    if (Number(radius) > MAX_RADIUS_M) return "radius_too_large";
    if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) return "bad_coordinate";
  }
  const out = /\bout\s+(?:center\s+)?(\d{1,4})\s*;\s*$/.exec(query.trim());
  if (!out || Number(out[1]) > 500) return "bad_output_limit";
  return null;
}

/**
 * Ask Overpass, trying each endpoint in turn. `null` when none answered with
 * usable JSON.
 */
export async function relayOverpass(query, { fetchImpl = fetch, endpoints = OVERPASS_ENDPOINTS } = {}) {
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!response.ok) continue;
      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) continue;
      const body = JSON.parse(text);
      if (body && Array.isArray(body.elements)) return { endpoint, body };
    } catch {
      // The next endpoint, or null.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
