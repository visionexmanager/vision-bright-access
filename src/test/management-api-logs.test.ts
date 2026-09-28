import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Supabase retired the Management API's analytics/endpoints/logs.all on
// 2026-09-23. It answers with a "removed" message rather than rows, so every
// diagnose step built on it printed an empty result that reads exactly like
// "Meta never called". The replacement is one `logs` table filtered by
// `source`, with fields in log_attributes.

const workflows = readdirSync(".github/workflows")
  .filter((name) => /\.ya?ml$/.test(name))
  .map((name) => ({ name, text: readFileSync(`.github/workflows/${name}`, "utf8") }));

describe("workflows reading Supabase logs", () => {
  it("never call the retired logs.all endpoint", () => {
    for (const { name, text } of workflows) {
      expect(text, name).not.toMatch(/analytics\/endpoints\/logs\.all/);
    }
  });

  it("query the unified logs table by source, not the old per-source tables", () => {
    const readers = workflows.filter(({ text }) => text.includes("analytics/endpoints/logs"));
    expect(readers.map((w) => w.name).sort()).toEqual(["ai-route-report.yml", "messenger-diagnose.yml", "whatsapp-diagnose.yml"]);
    for (const { name, text } of readers) {
      expect(text, name).not.toMatch(/from (edge_logs|function_logs|function_edge_logs)\b/);
      expect(text, name).not.toMatch(/source = 'edge_logs'/);
      expect(text, name).toMatch(/from logs\s+where source = 'function_logs'/);
      // A failed query is shown, so it cannot pass for an empty log.
      expect(text, name).toMatch(/Log query failed/);
    }
  });

  it("the diagnose workflows read Edge Function calls from function_edge_logs", () => {
    // Edge Function calls are in function_edge_logs; edge_logs never has them.
    for (const { name, text } of workflows.filter((w) => /diagnose\.ya?ml$/.test(w.name) && w.text.includes("analytics/endpoints/logs"))) {
      expect(text, name).toMatch(/from logs\s+where source = 'function_edge_logs' and log_attributes\['request\.pathname'\]/);
    }
  });

  it("still prints only a request's path, never its URL", () => {
    // Meta's GET handshake carries the verify token in its query string.
    for (const { name, text } of workflows.filter((w) => w.text.includes("analytics/endpoints/logs"))) {
      expect(text, name).not.toMatch(/log_attributes\['request\.(url|search|query)/);
    }
  });
});
