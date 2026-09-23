import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const conf = readFileSync(resolve(__dirname, "../../server/nginx/visionex-hardening.conf"), "utf8").replace(/\r\n/g, "\n");
const workflow = readFileSync(resolve(__dirname, "../../.github/workflows/nginx-hardening.yml"), "utf8").replace(/\r\n/g, "\n");

/** Directives only: comments removed. */
const directives = conf.split("\n").map((line) => line.replace(/#.*/, "")).join("\n");

/** The Cache-Control nginx would choose for a request, following the map's rules. */
function cacheControlFor(uri: string, contentType: string): string {
  const block = /map "\$uri\|\$sent_http_content_type" \$vx_cache_control \{([\s\S]*?)\n\}/.exec(directives);
  if (!block) throw new Error("the cache-control map is missing");
  const rules = [...block[1].matchAll(/"~([^"]+)"\s+"([^"]*)"/g)].map(([, pattern, value]) => ({ pattern, value }));
  expect(rules.length).toBeGreaterThan(0);
  const subject = `${uri}|${contentType}`;
  // nginx map: regexes in order, first match wins, else the default.
  const hit = rules.find(({ pattern }) => new RegExp(pattern).test(subject));
  return hit ? hit.value : "";
}

describe("nginx hardening snippet", () => {
  it("does not repeat `gzip on`, which Ubuntu's nginx.conf already sets in the same block", () => {
    expect(directives).not.toMatch(/^\s*gzip\s+on\s*;/m);
    expect(directives).toMatch(/gzip_types[\s\S]*application\/javascript[\s\S]*;/);
  });

  it("caches hashed build output for a year", () => {
    expect(cacheControlFor("/assets/index-abc.js", "application/javascript")).toBe("public, max-age=31536000, immutable");
    expect(cacheControlFor("/assets/index-abc.css", "text/css")).toBe("public, max-age=31536000, immutable");
    expect(cacheControlFor("/assets/logo-abc.webp", "image/webp")).toBe("public, max-age=31536000, immutable");
  });

  it("never pins the index.html a missing asset falls back to", () => {
    expect(cacheControlFor("/assets/deleted-chunk.js", "text/html")).toBe("no-cache");
    expect(cacheControlFor("/", "text/html")).toBe("no-cache");
    expect(cacheControlFor("/services", "text/html; charset=utf-8")).toBe("no-cache");
  });

  it("leaves other files to nginx's defaults", () => {
    expect(cacheControlFor("/robots.txt", "text/plain")).toBe("");
    expect(cacheControlFor("/og-image.png", "image/png")).toBe("");
  });

  it("sends HSTS only over https, without claiming every subdomain", () => {
    expect(directives).toMatch(/map \$scheme \$vx_hsts \{\s*default "";\s*https\s+"max-age=\d+";\s*\}/);
    expect(directives).not.toMatch(/includeSubDomains|preload/i);
    expect(directives).toMatch(/add_header Strict-Transport-Security \$vx_hsts always;/);
  });

  it("sets the headers production was missing, and hides the version", () => {
    for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Cache-Control", "Content-Security-Policy", "Permissions-Policy"]) {
      expect(directives).toMatch(new RegExp(`add_header ${header} `));
    }
    expect(directives).toMatch(/^server_tokens off;/m);
  });

  it("keeps the CSP to directives that cannot break a page, and keeps the site's own camera and microphone", () => {
    const csp = /add_header Content-Security-Policy\s+"([^"]+)"/.exec(directives)?.[1] ?? "";
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/script-src|style-src|connect-src|default-src|upgrade-insecure-requests/);
    const permissions = /add_header Permissions-Policy\s+"([^"]+)"/.exec(directives)?.[1] ?? "";
    for (const own of ["camera=(self)", "microphone=(self)", "geolocation=(self)"]) expect(permissions).toContain(own);
  });
});

describe("nginx hardening workflow", () => {
  it("can only be run by hand, with read-only repository access", () => {
    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:/m);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it("tests the configuration before every reload and restores on failure", () => {
    const reloads = workflow.match(/sudo systemctl reload nginx/g) ?? [];
    expect(reloads.length).toBeGreaterThan(0);
    for (const step of ["Apply compression", "Redirect plain HTTP"]) {
      const body = workflow.slice(workflow.indexOf(`name: ${step}`));
      const test = body.indexOf("nginx -t");
      const reload = body.indexOf("systemctl reload nginx");
      expect(test, `${step} must run nginx -t`).toBeGreaterThan(-1);
      expect(test, `${step} must test before it reloads`).toBeLessThan(reload);
      expect(body.slice(0, body.indexOf("REMOTE\n", body.indexOf("<<'REMOTE'") + 10))).toMatch(/restor/i);
    }
  });

  it("keeps the retired site's file and refuses to drop a route only it serves", () => {
    expect(workflow).toMatch(/sudo rm -f "\$p"/);
    expect(workflow).not.toMatch(/rm -f[^\n]*sites-available/);
    expect(workflow).toMatch(/REFUSED: \$\(basename "\$p"\) routes/);
  });
});
