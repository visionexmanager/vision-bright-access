/**
 * Open data portals on CKAN, keyless: the Humanitarian Data Exchange (OCHA)
 * and the Government of Canada's open data portal. One adapter, one config
 * per portal — any other CKAN portal is a new entry here.
 */

import { allowsRedistribution, clean, cleanOrNull, getJson, httpsUrl, makeItem, positiveNumber, tagList } from "../http.ts";
import type { ContentProvider, ExternalContentItem } from "../types.ts";

const DATA_FORMATS: Record<string, string> = {
  CSV: "text/csv", JSON: "application/json", GEOJSON: "application/geo+json", XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  XLS: "application/vnd.ms-excel", XML: "application/xml", PDF: "application/pdf",
};

interface CkanConfig {
  id: string;
  name: string;
  homepage: string;
  apiBase: string;
  datasetBase: string;
  licenseNote: string;
  healthQuery: string;
}

export function parseCkan(data: unknown, config: Pick<CkanConfig, "id" | "name" | "datasetBase">): ExternalContentItem[] {
  const results = ((data as { result?: { results?: Array<Record<string, unknown>> } })?.result?.results) ?? [];
  return results.flatMap((pkg) => {
    const name = typeof pkg.name === "string" && /^[a-z0-9_-]{1,200}$/.test(pkg.name) ? pkg.name : null;
    const title = clean(pkg.title, 200);
    if (!name || !title) return [];
    const licenseName = clean(pkg.license_title, 120);
    const license = licenseName ? { name: licenseName, url: httpsUrl(pkg.license_url) } : null;
    const resources = ((pkg.resources as Array<Record<string, unknown>>) ?? []).filter((r) => httpsUrl(r.url));
    const file = resources.find((r) => DATA_FORMATS[String(r.format).toUpperCase()]) ?? resources[0];
    const format = file ? String(file.format).toUpperCase() : "";
    const org = (pkg.organization ?? {}) as { title?: string };
    return [makeItem(config.name, {
      provider: config.id,
      providerItemId: name,
      title,
      description: cleanOrNull(pkg.notes, 400),
      contentType: "dataset",
      mimeType: DATA_FORMATS[format] ?? null,
      externalUrl: `${config.datasetBase}${name}`,
      downloadUrl: file && allowsRedistribution(license) ? httpsUrl(file.url) : null,
      sizeBytes: file ? positiveNumber(file.size) : null,
      publisher: cleanOrNull(org.title, 160),
      license,
      attribution: license ? [clean(org.title, 160), license.name].filter(Boolean).join(", ") : null,
      tags: tagList(pkg.tags, 6),
      publishedAt: typeof pkg.metadata_modified === "string" ? pkg.metadata_modified.slice(0, 10) : null,
    })];
  });
}

function ckanProvider(config: CkanConfig): ContentProvider {
  return {
    id: config.id,
    name: config.name,
    homepage: config.homepage,
    docs: "https://docs.ckan.org/en/latest/api/",
    categories: ["data"],
    auth: { kind: "none" },
    capabilities: { search: true, preview: false, embed: false, download: true },
    licenseNote: config.licenseNote,
    rateLimit: "No published quota for read-only package_search.",
    healthQuery: config.healthQuery,
    async search(params, ctx) {
      const q = new URLSearchParams({ q: params.query, rows: String(params.limit), start: String((params.page - 1) * params.limit) });
      return parseCkan(await getJson(ctx, `${config.apiBase}/action/package_search?${q}`), config);
    },
  };
}

export const humanitarianDataExchange = ckanProvider({
  id: "hdx",
  name: "Humanitarian Data Exchange",
  homepage: "https://data.humdata.org",
  apiBase: "https://data.humdata.org/api/3",
  datasetBase: "https://data.humdata.org/dataset/",
  licenseNote: "Datasets from UN agencies, NGOs and governments; each states its own licence, and files are offered only under open ones.",
  healthQuery: "education",
});

export const openCanada = ckanProvider({
  id: "open_canada",
  name: "Open Government Canada",
  homepage: "https://open.canada.ca",
  apiBase: "https://open.canada.ca/data/api/3",
  datasetBase: "https://open.canada.ca/data/en/dataset/",
  licenseNote: "Most datasets are under the Open Government Licence – Canada, which allows reuse with attribution.",
  healthQuery: "education",
});
