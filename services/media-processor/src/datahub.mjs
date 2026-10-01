// Read access to the Data Hub, and nothing else.
//
// The datasets live on this server's persistent disk. The disk is mounted into the container READ-ONLY, and
// this is the one door to it: a caller names a dataset and a path inside it; it never names a filesystem path.
//
//   • the dataset is a slug, looked up among the installed ones (never joined into a path as typed);
//   • the path is a list of plain segments, no "..", no separators, no hidden files, at most eight deep;
//   • the dataset's `current` pointer is resolved once and everything must stay inside that version;
//   • no symbolic link is followed below it, and a file that is executable is not served;
//   • only data formats are served, up to 20 MB.
//
// Pure functions over a root directory: the server wraps them in authenticated routes.

import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { join, sep } from "node:path";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const MAX_DEPTH = 8;

/** The data formats served, and what to call them. A name with no extension is served as plain text. */
export const TYPES = Object.freeze({
  txt: "text/plain; charset=utf-8", md: "text/plain; charset=utf-8", json: "application/json", xml: "application/xml",
  csv: "text/csv; charset=utf-8", tsv: "text/tab-separated-values; charset=utf-8", tab: "text/plain; charset=utf-8",
  zi: "text/plain; charset=utf-8", dtd: "application/xml-dtd", ldml: "application/xml", ldmlbcp47: "application/xml", xsd: "application/xml",
  html: "text/plain; charset=utf-8",
});

export class DataHubError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/** The installed datasets: slug, group, active version, size. Reads manifests, not file contents. */
export async function listDatasets(root) {
  const out = [];
  let groups;
  try {
    groups = await readdir(join(root, "datasets"), { withFileTypes: true });
  } catch {
    throw new DataHubError("not_mounted", 503);
  }
  for (const group of groups) {
    if (!group.isDirectory() || !SLUG.test(group.name)) continue;
    let names;
    try { names = await readdir(join(root, "datasets", group.name), { withFileTypes: true }); } catch { continue; }
    for (const d of names) {
      if (!d.isDirectory() || !SLUG.test(d.name)) continue;
      try {
        const manifest = JSON.parse(await readFile(join(root, "datasets", group.name, d.name, "current", "MANIFEST.json"), "utf8"));
        out.push({ slug: d.name, group: group.name, version: String(manifest.version ?? ""), extracted_bytes: Number(manifest.extracted_bytes ?? 0) });
      } catch { /* a dataset with no active version is not listed */ }
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** The last storage measurement the server wrote. */
export async function readStorage(root) {
  try {
    return JSON.parse(await readFile(join(root, "manifests", "storage.json"), "utf8"));
  } catch {
    throw new DataHubError("no_measurement", 404);
  }
}

/** Finds an installed dataset by slug; the slug is compared, never used to build a path. */
async function findDataset(root, slug) {
  if (typeof slug !== "string" || !SLUG.test(slug)) throw new DataHubError("bad_dataset", 400);
  const known = (await listDatasets(root)).find((d) => d.slug === slug);
  if (!known) throw new DataHubError("unknown_dataset", 404);
  return known;
}

/** Validates a caller's path and returns the file to serve, or throws a coded refusal. */
export async function resolveDatasetFile(root, slug, relPath) {
  if (typeof relPath !== "string" || relPath.length === 0 || relPath.length > 600 || relPath.includes("\0") || relPath.includes("\\")) {
    throw new DataHubError("bad_path", 400);
  }
  const segments = relPath.split("/");
  if (segments.length > MAX_DEPTH || segments.some((s) => !SEGMENT.test(s) || s === "." || s === "..")) {
    throw new DataHubError("bad_path", 400);
  }
  const name = segments[segments.length - 1];
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  if (ext && !Object.hasOwn(TYPES, ext)) throw new DataHubError("type_not_served", 415);
  // The path is shaped before anything is looked up on disk; the dataset is then found among the installed ones.
  const dataset = await findDataset(root, slug);

  // `current` is a pointer to versions/<v>; resolve it once and stay inside the version it names.
  const pointer = join(root, "datasets", dataset.group, dataset.slug, "current");
  let versionRoot;
  try { versionRoot = await realpath(pointer); } catch { throw new DataHubError("unknown_dataset", 404); }
  const allowed = await realpath(join(root, "datasets", dataset.group, dataset.slug, "versions")).catch(() => null);
  if (!allowed || !(versionRoot + sep).startsWith(allowed + sep)) throw new DataHubError("bad_pointer", 500);

  // Walk it segment by segment: no link anywhere below the version.
  let here = versionRoot;
  for (const segment of segments) {
    here = join(here, segment);
    let info;
    try { info = await lstat(here); } catch { throw new DataHubError("not_found", 404); }
    if (info.isSymbolicLink()) throw new DataHubError("link_refused", 403);
  }
  const info = await stat(here);
  if (!info.isFile()) throw new DataHubError("not_a_file", 404);
  if ((info.mode & 0o111) !== 0) throw new DataHubError("executable_refused", 403);
  if (info.size > MAX_FILE_BYTES) throw new DataHubError("too_large", 413);
  const real = await realpath(here);
  if (!(real + sep).startsWith(versionRoot + sep) && real !== versionRoot) throw new DataHubError("outside_dataset", 403);
  return { path: real, size: info.size, type: TYPES[ext] ?? "text/plain; charset=utf-8", dataset };
}
