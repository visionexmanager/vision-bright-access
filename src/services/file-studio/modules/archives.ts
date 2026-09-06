// ─── Archive Converter Module ────────────────────────────────────────────────
//
// This was a stub. It waited three hundred milliseconds and returned "Archive
// conversion to TAR requires server processing. Available in Phase 12." Phase 12
// was never built, and none of this ever needed a server: the containers are in
// `archiveFormats.ts` and the codecs are the browser's own.
//
// What a conversion means here is repackaging — the same files, the same paths,
// the same timestamps, a different container:
//
//   .zip → .tar, .gz        .tar → .zip, .gz        .gz → .tar, .zip
//
// A `.gz` target is a gzipped TAR, because that is what a person means by
// "make this a .gz" when they are holding a folder of files, and because GZIP
// on its own holds exactly one member.
//
// 7z and RAR are readable by neither this nor any browser, so they are inputs
// that are offered no target rather than targets that always fail.

import type {
  ConverterModule,
  ConversionResult,
  ArchiveOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { ARCHIVE_FORMATS } from "@/lib/types/fileStudio";
import {
  ArchiveError,
  gunzip,
  gzip,
  looksLikeTar,
  readTar,
  readZip,
  writeTar,
  writeZip,
  type ArchiveEntry,
} from "./archiveFormats";

/**
 * What each archive can become.
 *
 * `engine.ts` reads this rather than restating it, so the page's menu cannot
 * offer a pair `convert()` below does not implement.
 */
export const ARCHIVE_WORKING_TARGETS: Record<string, readonly string[]> = {
  zip: ["tar", "gz"],
  tar: ["zip", "gz"],
  gz: ["tar", "zip"],
};

const MIME: Record<string, string> = {
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
};

async function readEntries(file: File, format: string, bytes: Uint8Array): Promise<ArchiveEntry[]> {
  if (format === "zip") return await readZip(bytes);
  if (format === "tar") return readTar(bytes);

  // GZIP holds one member and does not name it. In practice that member is
  // almost always a TAR — a `.tar.gz` — and when it is not, the member is the
  // file itself, named by stripping the `.gz` the way `gunzip` does.
  const inner = await gunzip(bytes);
  if (looksLikeTar(inner)) return readTar(inner);
  return [{ name: file.name.replace(/\.gz$/i, "") || "file", data: inner, mtime: new Date(file.lastModified) }];
}

async function writeArchive(entries: ArchiveEntry[], target: string): Promise<Uint8Array> {
  if (target === "zip") return await writeZip(entries);
  if (target === "tar") return writeTar(entries);
  return await gzip(writeTar(entries));
}

export const ArchiveModule: ConverterModule = {
  moduleType: "archive",
  // 7z and RAR stay here: the page recognises the file and says why it cannot
  // open it, which is more use than not recognising it at all.
  supportedInputFormats: [...ARCHIVE_FORMATS],
  supportedOutputFormats: ["zip", "tar", "gz"],
  canHandleInBrowser: true,

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as ArchiveOptions;
    const start = Date.now();
    const inFmt = file.name.split(".").pop()?.toLowerCase() ?? "";

    const targets = ARCHIVE_WORKING_TARGETS[inFmt];
    if (!targets) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: `${inFmt.toUpperCase()} archives need a decoder no browser has. ZIP, TAR and GZIP all convert here.`,
      };
    }
    if (!targets.includes(opts.targetFormat)) {
      return {
        success: false,
        processingMs: Date.now() - start,
        error: `A ${inFmt.toUpperCase()} archive cannot become a ${opts.targetFormat.toUpperCase()} file.`,
      };
    }

    try {
      onProgress(10);
      const bytes = new Uint8Array(await file.arrayBuffer());
      onProgress(30);

      const entries = await readEntries(file, inFmt, bytes);
      onProgress(60);

      const out = await writeArchive(entries, opts.targetFormat);
      onProgress(100);

      const resultBlob = new Blob([out as unknown as BlobPart], {
        type: MIME[opts.targetFormat] ?? "application/octet-stream",
      });
      return {
        success: true,
        resultUrl: URL.createObjectURL(resultBlob),
        resultBlob,
        resultSize: resultBlob.size,
        processingMs: Date.now() - start,
        metadata: { entries: entries.length },
      };
    } catch (err) {
      // An ArchiveError says something a person can act on — the archive is
      // encrypted, or damaged, or carries a path that would escape. Anything
      // else is this code failing, and says so without quoting an exception.
      return {
        success: false,
        processingMs: Date.now() - start,
        error:
          err instanceof ArchiveError
            ? err.message
            : "This archive couldn't be converted. It may be damaged, or not the format it claims.",
      };
    }
  },
};
