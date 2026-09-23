// Overpass through Visionex's own server.
//
// overpass-api.de answers 406 to Supabase's network (health-check showed it on
// every run), so "what is near me" is asked from the VPS. The relay there must
// accept exactly what the assistant sends and nothing that would make it an
// open proxy for expensive queries.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { checkOverpassQuery, relayOverpass, MAX_RADIUS_M } from "../../services/media-processor/src/overpass.mjs";
import { fetchNearby } from "../../supabase/functions/_shared/whatsappGeo.ts";
import { overpassViaProcessor } from "../../supabase/functions/_shared/whatsappProcessor.ts";

const ORIGIN = { latitude: 31.9539, longitude: 35.9106 };
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every query the assistant can send, captured from the real builder. */
async function queriesTheAssistantSends(): Promise<string[]> {
  const queries: string[] = [];
  const relay = vi.fn(async (query: string) => {
    queries.push(query);
    return [];
  });
  vi.stubGlobal("fetch", vi.fn(async () => ok({ features: [], elements: [] })));
  for (const category of [null, "pharmacy", "university", "hotel", "park", "mall", "bus_stop"]) {
    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "ar", category, { relay });
  }
  return queries;
}

describe("the relay's query check", () => {
  it("accepts every query the assistant builds, including the wider second round", async () => {
    const queries = await queriesTheAssistantSends();
    expect(queries.length).toBeGreaterThanOrEqual(7);
    expect(queries.some((q) => q.includes(`around:${MAX_RADIUS_M},`))).toBe(true);
    for (const query of queries) expect(checkOverpassQuery(query), query).toBeNull();
  });

  it("accepts the health-check probe", () => {
    const source = readFileSync("supabase/functions/health-check/index.ts", "utf8");
    const template = /overpassViaProcessor\(\s*`([^`]+)`/.exec(source)?.[1];
    expect(template).toBeTruthy();
    const query = template!.replace("${MAP_PROBE.lat}", "31.95").replace("${MAP_PROBE.lon}", "35.91");
    expect(checkOverpassQuery(query)).toBeNull();
  });

  it("refuses what would make it an open proxy", () => {
    const refusals: Array<[unknown, string]> = [
      [undefined, "missing_query"],
      ["", "missing_query"],
      ["x".repeat(3000), "query_too_long"],
      ['[out:xml][timeout:8];(nwr(around:100,1,1)["name"];);out center 5;', "bad_header"],
      ['[out:json][timeout:90];(nwr(around:100,1,1)["name"];);out center 5;', "timeout_too_long"],
      ['[out:json][timeout:8];(nwr["amenity"="school"];);out center 5;', "unbounded_statement"],
      ['[out:json][timeout:8];(nwr(around:100,1,1)["name"];way["highway"];);out center 5;', "unbounded_statement"],
      ['[out:json][timeout:8];(nwr(around:900000,1,1)["name"];);out center 5;', "radius_too_large"],
      ['[out:json][timeout:8];(nwr(around:100,95,1)["name"];);out center 5;', "bad_coordinate"],
      ['[out:json][timeout:8];area["name"="Jordan"]->.a;(nwr(area.a)["name"];);out center 5;', "disallowed_statement"],
      ['[out:json][timeout:8];(nwr(around:100,1,1)["name"];);out center 9999;', "bad_output_limit"],
      ['[out:json][timeout:8];(nwr(around:100,1,1)["name"];);out body;', "bad_output_limit"],
      ["[out:json][timeout:8];out count;", "bad_statements"],
    ];
    for (const [query, reason] of refusals) {
      expect(checkOverpassQuery(query), String(query).slice(0, 60)).toBe(reason);
    }
  });
});

describe("relaying", () => {
  const query = '[out:json][timeout:8];(nwr(around:1200,31.95,35.91)["amenity"~"^(pharmacy)$"]["name"];);out center 48;';

  it("identifies itself, and moves to the next endpoint when one fails", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("first")) return { ok: false, status: 406, text: async () => "" } as unknown as Response;
      return ok({ elements: [{ lat: 1, lon: 2, tags: { name: "A" } }] });
    });
    const answer = await relayOverpass(query, { fetchImpl, endpoints: ["https://first.test/api", "https://second.test/api"] });
    expect(answer?.endpoint).toBe("https://second.test/api");
    expect(answer?.body.elements).toHaveLength(1);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/VisionexAssistant/);
    expect(String(calls[0].init.body)).toBe(`data=${encodeURIComponent(query)}`);
  });

  it("answers null when nobody does", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("down"); });
    expect(await relayOverpass(query, { fetchImpl, endpoints: ["https://a.test", "https://b.test"] })).toBeNull();
  });

  it("is a guarded route on the server", () => {
    const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
    const route = server.indexOf('url.pathname === "/overpass"');
    expect(route).toBeGreaterThan(server.indexOf("if (!authorised(req))"));
    expect(server).toContain("const refused = checkOverpassQuery(query);");
    expect(server).toMatch(/MAX_OVERPASS_BODY = 4_096/);
  });
});

describe("the assistant's side", () => {
  const read = (name: string) =>
    ({ MEDIA_PROCESSOR_URL: "https://visionex.app/internal/media", MEDIA_PROCESSOR_TOKEN: "t0k" } as Record<string, string>)[name];

  it("sends the query with the service token and reads the elements back", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => ok({ ok: true, elements: [{ tags: { name: "X" } }] }));
    const elements = await overpassViaProcessor("Q", { read, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(elements).toEqual([{ tags: { name: "X" } }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://visionex.app/internal/media/overpass");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0k");
    expect(JSON.parse(String(init.body))).toEqual({ query: "Q" });
  });

  it("does nothing when the service is not configured, and survives a failure", async () => {
    const fetchImpl = vi.fn();
    expect(await overpassViaProcessor("Q", { read: () => undefined, fetchImpl: fetchImpl as unknown as typeof fetch })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }) as unknown as Response);
    expect(await overpassViaProcessor("Q", { read, fetchImpl: failing as unknown as typeof fetch })).toBeNull();
  });

  it("uses the relay's answer, and asks Overpass directly when the relay has none", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(String(url));
      return ok(String(url).includes("photon") ? { features: [] } : { elements: [] });
    }));
    const near = { lat: ORIGIN.latitude + 0.001, lon: ORIGIN.longitude, tags: { amenity: "pharmacy", name: "Relayed" } };
    const places = await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", "pharmacy", { relay: async () => [near] });
    expect(places?.[0].name).toBe("Relayed");
    expect(urls.some((u) => u.includes("overpass-api.de"))).toBe(false);

    urls.length = 0;
    await fetchNearby(ORIGIN.latitude, ORIGIN.longitude, "en", "pharmacy", { relay: async () => null });
    expect(urls.some((u) => u.includes("overpass-api.de"))).toBe(true);
  });

  it("is wired into the webhook", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).toContain("{ relay: (query) => overpassViaProcessor(query) }");
  });
});
