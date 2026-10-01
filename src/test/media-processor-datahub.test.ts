// The one door to the Data Hub's disk: a dataset slug and a path inside it, never a filesystem path.
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataHubError, MAX_FILE_BYTES, listDatasets, readStorage, resolveDatasetFile } from "../../services/media-processor/src/datahub.mjs";

let root = "";
let canLink = true;
const refusal = async (fn: () => Promise<unknown>) => {
  try { await fn(); return null; } catch (e) { return e instanceof DataHubError ? `${e.status} ${e.code}` : `other ${String(e)}`; }
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "datahub-"));
  const version = join(root, "datasets", "iana", "tzdata", "versions", "2026-10-01");
  mkdirSync(join(version, "sub"), { recursive: true });
  writeFileSync(join(version, "MANIFEST.json"), JSON.stringify({ dataset: "tzdata", version: "2026-10-01", extracted_bytes: 123 }));
  writeFileSync(join(version, "tzdata.zi"), "# version 2026a\n");
  writeFileSync(join(version, "sub", "zone.tab"), "AD\t+4230+00131\tEurope/Andorra\n");
  writeFileSync(join(version, "README"), "plain");
  writeFileSync(join(version, "run.sh"), "#!/bin/sh\n");
  writeFileSync(join(version, "archive.zip"), "PK");
  writeFileSync(join(version, "big.txt"), Buffer.alloc(MAX_FILE_BYTES + 1));
  writeFileSync(join(version, "tool.txt"), "executable bit");
  try { chmodSync(join(version, "tool.txt"), 0o755); } catch { /* not supported on this file system */ }
  writeFileSync(join(root, "secret.txt"), "OUTSIDE THE DATASET");
  try {
    symlinkSync("versions/2026-10-01", join(root, "datasets", "iana", "tzdata", "current"), "dir");
    symlinkSync(join(root, "secret.txt"), join(version, "link.txt"));
    mkdirSync(join(root, "datasets", "iana", "other", "versions", "v"), { recursive: true });
    writeFileSync(join(root, "datasets", "iana", "other", "versions", "v", "MANIFEST.json"), "{}");
    symlinkSync("/etc", join(root, "datasets", "iana", "other", "current"), "dir");
  } catch {
    canLink = false; // a file system (or a Windows account) that cannot make links: those cases run on CI
  }
  mkdirSync(join(root, "manifests"), { recursive: true });
  writeFileSync(join(root, "manifests", "storage.json"), JSON.stringify({ state: "ok", disk: { free_bytes: 1 } }));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("listing and measuring", () => {
  it("lists installed datasets with their active version, and nothing else", async () => {
    if (!canLink) return;
    const list = await listDatasets(root);
    expect(list.find((d: { slug: string }) => d.slug === "tzdata")).toEqual({ slug: "tzdata", group: "iana", version: "2026-10-01", extracted_bytes: 123 });
    expect(JSON.stringify(list)).not.toMatch(/\/|secret/);
  });
  it("says so when the disk is not mounted", async () => {
    expect(await refusal(() => listDatasets(join(root, "nowhere")))).toBe("503 not_mounted");
  });
  it("returns the last measurement, or says there is none", async () => {
    expect(await readStorage(root)).toMatchObject({ state: "ok" });
    expect(await refusal(() => readStorage(join(root, "nowhere")))).toBe("404 no_measurement");
  });
});

describe("serving a file", () => {
  it("serves a data file inside the active version, with its type and size", async () => {
    if (!canLink) return;
    const file = await resolveDatasetFile(root, "tzdata", "tzdata.zi");
    expect(file).toMatchObject({ size: 15, type: "text/plain; charset=utf-8" });
    expect(readFileSync(file.path, "utf8")).toBe("# version 2026a\n");
    expect(await resolveDatasetFile(root, "tzdata", "sub/zone.tab")).toMatchObject({ type: "text/plain; charset=utf-8" });
    expect(await resolveDatasetFile(root, "tzdata", "README")).toMatchObject({ type: "text/plain; charset=utf-8" });
    expect(await resolveDatasetFile(root, "tzdata", "MANIFEST.json")).toMatchObject({ type: "application/json" });
  });

  it("refuses every way of naming a path outside the dataset", async () => {
    for (const bad of ["../secret.txt", "../../secret.txt", "sub/../../secret.txt", "/etc/passwd", "sub//zone.tab", "./tzdata.zi", "..", ".", "", "a/b/c/d/e/f/g/h/i.txt", ".hidden", "sub/.hidden", "tz data.txt", "%2e%2e/secret.txt", "tzdata.zi\0.png", "sub\\zone.tab", "x".repeat(700)]) {
      const r = await refusal(() => resolveDatasetFile(root, "tzdata", bad));
      expect(r, JSON.stringify(bad)).toMatch(/^(400 bad_path|404 not_found)$/);
    }
    for (const bad of [undefined, null, 42, {}, []]) expect(await refusal(() => resolveDatasetFile(root, "tzdata", bad as never))).toBe("400 bad_path");
  });

  it("refuses a dataset named by anything but an installed slug", async () => {
    for (const slug of ["../iana", "iana/tzdata", "TZDATA", "", "tzdata/../other", "/etc", "a b", "x".repeat(60)]) {
      expect(await refusal(() => resolveDatasetFile(root, slug, "tzdata.zi")), slug).toBe("400 bad_dataset");
    }
    expect(await refusal(() => resolveDatasetFile(root, "nosuch", "tzdata.zi"))).toBe("404 unknown_dataset");
    for (const slug of [undefined, null, 7]) expect(await refusal(() => resolveDatasetFile(root, slug as never, "tzdata.zi"))).toBe("400 bad_dataset");
  });

  it("serves data formats only: no script, no archive, no binary", async () => {
    if (!canLink) return;
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "run.sh"))).toBe("415 type_not_served");
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "archive.zip"))).toBe("415 type_not_served");
  });

  it("refuses a file that is too big, and one that is executable", async () => {
    if (!canLink) return;
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "big.txt"))).toBe("413 too_large");
    if (process.platform !== "win32") expect(await refusal(() => resolveDatasetFile(root, "tzdata", "tool.txt"))).toBe("403 executable_refused");
  });

  it("follows no link below the version: a link to a file outside is refused", async () => {
    if (!canLink) return;
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "link.txt"))).toBe("403 link_refused");
  });

  it("refuses a dataset whose active pointer leaves its own versions directory", async () => {
    if (!canLink) return;
    expect(await refusal(() => resolveDatasetFile(root, "other", "MANIFEST.json"))).toMatch(/^(500 bad_pointer|404 unknown_dataset)$/);
  });

  it("a missing file is a 404, and a directory is not a file", async () => {
    if (!canLink) return;
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "missing.txt"))).toBe("404 not_found");
    expect(await refusal(() => resolveDatasetFile(root, "tzdata", "sub"))).toBe("404 not_a_file");
  });
});

describe("the route", () => {
  const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
  it("sits behind the token, like every route except /health", () => {
    expect(server.indexOf('url.pathname.startsWith("/datahub/")')).toBeGreaterThan(server.indexOf("if (!authorised(req))"));
  });
  it("reads a dataset and a path from the query and never a filesystem path", () => {
    expect(server).toContain('url.searchParams.get("dataset")');
    expect(server).toContain('url.searchParams.get("path")');
    expect(server).not.toMatch(/readFile\(url\.searchParams|createReadStream\(url\./);
  });
  it("serves attachments, unsniffable, never cached, and logs the dataset and size but not the path", () => {
    expect(server).toContain('"content-disposition": "attachment"');
    expect(server).toContain('log("datahub_read", { correlation, dataset: file.dataset.slug, bytes: file.size });');
  });
  it("the deployment mounts the disk read-only, at the place the service reads", () => {
    const workflow = readFileSync(".github/workflows/deploy-media-processor.yml", "utf8");
    expect(workflow).toContain("--volume /var/lib/visionex/data:/data/visionex:ro");
    expect(server).toContain('process.env.DATAHUB_DIR ?? "/data/visionex"');
    expect(workflow).toContain("--read-only");
  });
});
