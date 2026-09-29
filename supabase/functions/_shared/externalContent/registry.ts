/**
 * The one list of external content providers. Adding a provider means writing
 * its adapter and adding it here; the search, the item resolver, the provider
 * list and the admin health check all read this array.
 *
 * Order matters twice: it is the tie-break when two providers return the same
 * work (the earlier one is kept), and the order results are interleaved in.
 */

import { artic, clevelandMuseum, metMuseum } from "./providers/museums.ts";
import { core, dpla, europeana, flickr, freesound, googleBooks, jamendo, pexels, pixabay, podcastIndex, smithsonian, unsplash, vimeo, youtube } from "./providers/keyed.ts";
import { applePodcasts, dailymotion, radioBrowser } from "./providers/media.ts";
import { arxiv, openAlex } from "./providers/scholarly.ts";
import { doab, gutenberg, openLibrary, openStax } from "./providers/books.ts";
import { humanitarianDataExchange, openCanada } from "./providers/data.ts";
import { internetArchive, nasa } from "./providers/archives.ts";
import { openverse } from "./providers/openverse.ts";
import { wikibooks, wikimediaCommons, wikipedia, wikisource, wikiversity } from "./providers/wikimedia.ts";
import type { ContentProvider, GetEnv, ProviderStatus, ProviderSummary, UnsupportedProvider } from "./types.ts";

export const CONTENT_PROVIDERS: readonly ContentProvider[] = [
  // Keyless — answer today.
  wikimediaCommons,
  openverse,
  nasa,
  internetArchive,
  metMuseum,
  artic,
  clevelandMuseum,
  openLibrary,
  gutenberg,
  openStax,
  doab,
  wikibooks,
  wikisource,
  wikiversity,
  wikipedia,
  openAlex,
  arxiv,
  dailymotion,
  applePodcasts,
  radioBrowser,
  humanitarianDataExchange,
  openCanada,
  // Need a server secret — dormant until it is set.
  youtube,
  vimeo,
  unsplash,
  pexels,
  pixabay,
  flickr,
  freesound,
  jamendo,
  europeana,
  dpla,
  smithsonian,
  googleBooks,
  podcastIndex,
  core,
];

/**
 * Sources that were examined and deliberately not connected. Each reason is
 * what was found, with the date where it was measured.
 */
export const UNSUPPORTED_PROVIDERS: readonly UnsupportedProvider[] = [
  { id: "library_of_congress", name: "Library of Congress", homepage: "https://www.loc.gov", categories: ["images", "books", "audio", "video"], status: "unsupported",
    reason: "The loc.gov JSON API answered with a Cloudflare bot challenge (HTTP 403) on 2026-09-29. Getting past a bot challenge is not something the Library will do." },
  { id: "data_gov", name: "Data.gov", homepage: "https://data.gov", categories: ["data"], status: "unsupported",
    reason: "The CKAN endpoint catalog.data.gov/api/3 returned 404 on 2026-09-29, and no replacement search API is documented yet. Two other CKAN portals (HDX, Open Canada) are connected instead." },
  { id: "librivox", name: "LibriVox", homepage: "https://librivox.org", categories: ["audio", "books"], status: "unsupported",
    reason: "Its API took 21.5 s to answer one title search on 2026-09-29, far too slow for live search. Every LibriVox recording is also on the Internet Archive (collection librivoxaudio), and that search finds them." },
  { id: "europe_pmc", name: "Europe PMC", homepage: "https://europepmc.org", categories: ["documents"], status: "unsupported",
    reason: "Took 11.7 s to answer one search on 2026-09-29. OpenAlex and arXiv already cover open research papers." },
  { id: "khan_academy", name: "Khan Academy", homepage: "https://www.khanacademy.org", categories: ["education", "video"], status: "unsupported",
    reason: "Its public API was retired in 2020. Its videos can be found through YouTube once a YouTube key is set." },
  { id: "mit_ocw", name: "MIT OpenCourseWare", homepage: "https://ocw.mit.edu", categories: ["education"], status: "unsupported",
    reason: "There is no public search API. The content is CC BY-NC-SA and can be linked by hand." },
  { id: "oer_commons", name: "OER Commons", homepage: "https://oercommons.org", categories: ["education"], status: "unsupported",
    reason: "API tokens are issued only by request to OER Commons (docs.oercommons.org/api). Without a token the search response shape cannot be verified, so no adapter is guessed. If a token is granted, this becomes an adapter." },
  { id: "ted", name: "TED", homepage: "https://www.ted.com", categories: ["video", "education"], status: "unsupported",
    reason: "The public TED API was discontinued. TED talks are reachable through YouTube once a YouTube key is set." },
  { id: "spotify", name: "Spotify", homepage: "https://open.spotify.com", categories: ["audio"], status: "unsupported",
    reason: "Audio is DRM-protected, and 30-second previews were withdrawn from new apps in November 2024. A search would only return links out." },
  { id: "soundcloud", name: "SoundCloud", homepage: "https://soundcloud.com", categories: ["audio"], status: "unsupported",
    reason: "Registering an API app requires a paid SoundCloud Artist Pro account, and streams need OAuth. Openverse already serves Creative Commons audio from Jamendo and Freesound." },
  { id: "bing_google_images", name: "Bing / Google image search", homepage: "https://www.bing.com/images", categories: ["images"], status: "unsupported",
    reason: "Microsoft retired the Bing Search APIs in August 2025, and scraping Google Images breaks its terms. Results would also carry no licence." },
  { id: "commercial_stock", name: "Getty Images / Shutterstock / Adobe Stock", homepage: "https://www.gettyimages.com", categories: ["images", "video"], status: "unsupported",
    reason: "These are paid commercial licences under partner contracts. Nothing is free to show without buying a licence." },
  { id: "drm_stores", name: "Audible / Kindle / Apple Books", homepage: "https://www.audible.com", categories: ["books", "audio"], status: "unsupported",
    reason: "The content is DRM-protected and sold. There is no API that permits showing it in another library." },
  { id: "shadow_libraries", name: "LibGen / Z-Library / Sci-Hub / Anna's Archive", homepage: "https://en.wikipedia.org/wiki/Shadow_library", categories: ["books", "documents"], status: "unsupported",
    reason: "They distribute copyrighted works without permission. The Library will never link to them." },
  { id: "rijksmuseum", name: "Rijksmuseum", homepage: "https://data.rijksmuseum.nl", categories: ["images"], status: "unsupported",
    reason: "The new keyless Linked Art search (answered in 1.4 s on 2026-09-29) returns bare object IDs, and each needs a separate JSON-LD lookup. This is a candidate for later, not blocked. The Met, Chicago and Cleveland already cover public-domain art." },
];

export function providerById(id: string): ContentProvider | undefined {
  return CONTENT_PROVIDERS.find((p) => p.id === id);
}

export function missingEnv(provider: ContentProvider, env: GetEnv): string[] {
  if (provider.auth.kind !== "api_key") return [];
  return provider.auth.env.filter((name) => !env(name)?.trim());
}

export function providerStatus(provider: ContentProvider, env: GetEnv): ProviderStatus {
  return missingEnv(provider, env).length === 0 ? "ready" : "configuration_required";
}

/** Everything the web app may know about each provider: facts and state, never a value. */
export function summarizeProviders(env: GetEnv): ProviderSummary[] {
  return CONTENT_PROVIDERS.map(({ search: _search, getItem: _getItem, ...descriptor }) => {
    const provider = providerById(descriptor.id)!;
    return { ...descriptor, status: providerStatus(provider, env), missingEnv: missingEnv(provider, env) };
  });
}
