import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Radix Select (@radix-ui/react-select v2) throws at render time when a
// <SelectItem /> is given an empty-string value, because "" is reserved for
// clearing the selection. A single offending item takes the whole page down
// with "A <Select.Item /> must have a value prop that is not an empty string",
// and neither `tsc` nor eslint catches it — so guard the source instead.
//
// The fix is always the same: use a sentinel value (e.g. "__any__") for the
// "no filter" / "not specified" choice and map it back to ""/undefined.

const SRC_DIR = path.resolve(__dirname, "..", "..");

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (full.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

// Matches value="" and value={""} on a SelectItem opening tag.
const EMPTY_VALUE = /<SelectItem\b[^>]*?\bvalue=(?:""|\{\s*(?:""|'')\s*\})/s;

describe("Radix SelectItem values", () => {
  const files = collectTsxFiles(SRC_DIR);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("never uses an empty-string value, which crashes the page at render", () => {
    const offenders = files.filter((file) =>
      EMPTY_VALUE.test(readFileSync(file, "utf8"))
    );

    expect(
      offenders.map((f) => path.relative(SRC_DIR, f).replace(/\\/g, "/"))
    ).toEqual([]);
  });
});
