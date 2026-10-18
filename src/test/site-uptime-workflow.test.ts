import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const workflow = read(".github/workflows/site-uptime.yml");
const script = read("scripts/site-uptime-check.sh");

describe("site uptime monitor", () => {
  it("is scheduled, read-only and needs no secret", () => {
    expect(workflow).toMatch(/schedule:\n\s+- cron: "\*\/15 \* \* \* \*"/);
    expect(workflow).toMatch(/permissions:\n\s+contents: read/);
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toMatch(/\$\{\{\s*(github\.event|inputs)\./);
  });

  it("checks the page, the bundle's real content type and the certificate", () => {
    expect(script).toContain('id="root"');
    expect(script).toMatch(/javascript/i);
    expect(script).toContain("MIN_CERT_DAYS");
    expect(script).toContain("exit \"$fail\"");
  });

  it("never prints a response body", () => {
    expect(script).not.toMatch(/\bcat "\$tmp"|\becho "\$body"/);
    expect(script).toContain("-o /dev/null");
  });
});
