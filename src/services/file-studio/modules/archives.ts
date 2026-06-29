// ─── Archive Module (server-side stub — ZIP extraction via Phase 12) ─────────

import type {
  ConverterModule,
  ConversionResult,
  ArchiveOptions,
  ConversionOptions,
} from "@/lib/types/fileStudio";
import { ARCHIVE_FORMATS } from "@/lib/types/fileStudio";

export const ArchiveModule: ConverterModule = {
  moduleType: "archive",
  supportedInputFormats: [...ARCHIVE_FORMATS],
  supportedOutputFormats: [...ARCHIVE_FORMATS],
  canHandleInBrowser: false,

  async convert(
    _file: File,
    options: ConversionOptions,
    onProgress: (pct: number) => void
  ): Promise<ConversionResult> {
    const opts = options as ArchiveOptions;
    const start = Date.now();
    onProgress(10);
    await new Promise((r) => setTimeout(r, 300));
    onProgress(100);
    return {
      success: false,
      processingMs: Date.now() - start,
      error: `Archive conversion to ${opts.targetFormat.toUpperCase()} requires server processing. Available in Phase 12.`,
    };
  },
};
