// Emit crawler-readable HTML for the two URLs Meta App Review checks.
//
// Visionex is a single-page app: every route returns the same shell, and the
// policy text only exists after React and the locale chunk have run. A human
// reviewer sees the page fine. An automated check that reads the response body
// sees an empty <div id="root">, and "privacy policy URL returns no privacy
// policy" is a rejection rather than a question.
//
// ── Why a directory and not a server rule ──────────────────────────────────
//
// The SPA is built on the VPS and served by an nginx this repository does not
// own, so no location block can be added for these paths. It does not need to
// be: that nginx uses `try_files $uri $uri/ /index.html`, which is observable
// from outside — https://visionex.app/tools/ answers 403 (a directory with no
// index) rather than 200 (the SPA fallback). So `$uri/` is consulted before the
// fallback, and dist/privacy-policy/index.html is served for /privacy-policy
// with no server change at all.
//
// ── Why this does not fight React ──────────────────────────────────────────
//
// The markup goes inside <div id="root">, and the app mounts with
// createRoot().render(), which replaces the container's children. A visitor
// gets the React page exactly as before; only the pre-JavaScript body differs.
//
// ── Why it never fails the build ───────────────────────────────────────────
//
// This runs inside `npm run build` on a machine whose Node version this repo
// does not pin. A throw here would stop the whole site from deploying to fix a
// crawler nicety, so every failure is reported loudly and exits 0. That trades
// a silent miss for a broken deploy, and the miss is verifiable afterwards by
// curling the URL.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");

const warn = (message) => console.warn(`[prerender-legal] ${message}`);

// ── The English dictionary, read as text ───────────────────────────────────
//
// Parsed rather than imported: importing would mean either a TypeScript loader
// or a Node version that strips types, and neither is guaranteed on the build
// host. The file is one "key": "value" pair per line.
function readDictionary(path) {
  const source = readFileSync(path, "utf8");
  const entry = /^[ \t]*"((?:[^"\\]|\\.)*)"[ \t]*:[ \t]*"((?:[^"\\]|\\.)*)",?[ \t]*$/gm;
  const dict = Object.create(null);
  let match;
  while ((match = entry.exec(source)) !== null) {
    dict[unescapeJs(match[1])] = unescapeJs(match[2]);
  }
  return dict;
}

function unescapeJs(value) {
  return value.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, escape) => {
    if (escape[0] === "u") return String.fromCharCode(parseInt(escape.slice(1), 16));
    return { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" }[escape] ?? escape;
  });
}

/**
 * Read a string-or-number array literal out of a component.
 *
 * The component is the authority on which entries the page renders, so the
 * lists are taken from it rather than repeated here — otherwise adding a
 * processor to the policy would quietly leave it out of the crawled copy.
 */
function readArray(source, name, fallback) {
  const match = source.match(new RegExp(`const ${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (!match) {
    warn(`could not read ${name} from the component; using the built-in list`);
    return fallback;
  }
  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function buildPages(dict, privacySource) {
  const t = (key) => dict[key] ?? "";
  const collected = readArray(privacySource, "DATA_COLLECTED", []);
  const uses = readArray(privacySource, "DATA_USE", []);
  const parties = readArray(privacySource, "THIRD_PARTIES", []);

  const p = (text) => (text ? `<p>${escapeHtml(text)}</p>` : "");
  const h2 = (text) => (text ? `<h2>${escapeHtml(text)}</h2>` : "");

  const privacy = [
    `<h1>${escapeHtml(t("legal.privacy.title"))}</h1>`,
    p(t("legal.updated")),
    p(t("legal.privacy.intro")),

    h2(t("legal.privacy.collectTitle")),
    ...collected.map((item) =>
      `<h3>${escapeHtml(t(`legal.privacy.collect.${item}.heading`))}</h3>` +
      p(t(`legal.privacy.collect.${item}.text`)),
    ),

    h2(t("legal.privacy.useTitle")),
    `<ul>${uses.map((n) => `<li>${escapeHtml(t(`legal.privacy.use.${n}`))}</li>`).join("")}</ul>`,

    h2(t("legal.privacy.cookiesTitle")),
    p(t("legal.privacy.cookiesBody")),

    h2(t("legal.privacy.thirdTitle")),
    p(t("legal.privacy.thirdIntro")),
    ...parties.map((party) =>
      `<h3>${escapeHtml(t(`legal.privacy.third.${party}.name`))}</h3>` +
      p(t(`legal.privacy.third.${party}.purpose`)),
    ),
    p(t("legal.privacy.noSell")),

    ...["sharing", "security", "retention", "children"].flatMap((section) => [
      h2(t(`legal.privacy.${section}.title`)),
      p(t(`legal.privacy.${section}.body`)),
    ]),

    h2(t("legal.privacy.rightsTitle")),
    p(t("legal.privacy.rightsIntro")),
    ...["access", "correction", "deletion", "restriction", "portability", "optout"].map((right) =>
      `<h3>${escapeHtml(t(`legal.privacy.right.${right}.title`))}</h3>` +
      p(t(`legal.privacy.right.${right}.desc`)),
    ),
    p(`${t("legal.privacy.rightsContact")} hello@visionex.app`),
    `<p>${escapeHtml(t("legal.privacy.deletionLink"))} <a href="/data-deletion">/data-deletion</a></p>`,

    h2(t("legal.privacy.international.title")),
    p(t("legal.privacy.international.body")),
    h2(t("legal.privacy.changes.title")),
    p(t("legal.privacy.changes.body")),
    `<p>${escapeHtml(t("legal.privacy.inquiries"))} <a href="mailto:hello@visionex.app">hello@visionex.app</a></p>`,
  ].join("");

  const deletion = [
    `<h1>${escapeHtml(t("legal.dataDeletion.title"))}</h1>`,
    p(t("legal.updated")),
    p(t("legal.dataDeletion.intro")),
    h2(t("legal.dataDeletion.howTitle")),
    `<ol>${["step1", "step2", "step3"]
      .map((step) => `<li>${escapeHtml(t(`legal.dataDeletion.${step}`))}</li>`)
      .join("")}</ol>`,
    `<p>${escapeHtml(t("legal.dataDeletion.contact"))} <a href="mailto:hello@visionex.app">hello@visionex.app</a></p>`,
    ...["what", "timing", "account"].flatMap((section) => [
      h2(t(`legal.dataDeletion.${section}Title`)),
      p(t(`legal.dataDeletion.${section}Body`)),
    ]),
    `<p>${escapeHtml(t("legal.dataDeletion.footer"))} <a href="/privacy-policy">${escapeHtml(t("legal.privacy.title"))}</a></p>`,
  ].join("");

  return { privacy, deletion };
}

/**
 * Put the markup inside the shell's root container and correct the head.
 *
 * The shell's own <title> and description describe the whole platform, which
 * is the wrong answer for a crawler asking what this URL is.
 */
export function injectShell(shell, { body, title, description, canonical }) {
  let html = shell;

  const root = /<div id="root">\s*<\/div>/;
  if (!root.test(html)) throw new Error('dist/index.html has no empty <div id="root"></div> to fill');
  html = html.replace(root, `<div id="root">${body}</div>`);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta name="description" content="[\s\S]*?"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  html = html.replace("</head>", `  <link rel="canonical" href="${escapeHtml(canonical)}" />\n  </head>`);
  return html;
}

function main() {
  const shellPath = join(DIST, "index.html");
  if (!existsSync(shellPath)) {
    warn("dist/index.html not found — did vite build run? Skipping.");
    return;
  }

  const dict = readDictionary(join(ROOT, "src", "i18n", "en.ts"));
  if (!dict["legal.privacy.title"]) {
    warn("the English dictionary produced no legal strings — skipping rather than writing an empty page");
    return;
  }

  const privacySource = readFileSync(join(ROOT, "src", "pages", "legal", "PrivacyPolicy.tsx"), "utf8");
  const { privacy, deletion } = buildPages(dict, privacySource);
  const shell = readFileSync(shellPath, "utf8");

  const pages = [
    {
      route: "privacy-policy",
      body: privacy,
      title: `${dict["legal.privacy.title"]} — Visionex`,
      description: dict["legal.privacy.intro"]?.slice(0, 300) ?? "",
      canonical: "https://visionex.app/privacy-policy",
    },
    {
      route: "data-deletion",
      body: deletion,
      title: `${dict["legal.dataDeletion.title"]} — Visionex`,
      description: dict["legal.dataDeletion.intro"]?.slice(0, 300) ?? "",
      canonical: "https://visionex.app/data-deletion",
    },
  ];

  for (const page of pages) {
    const out = join(DIST, page.route, "index.html");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, injectShell(shell, page));
    console.log(`[prerender-legal] wrote dist/${page.route}/index.html (${page.body.length} bytes of copy)`);
  }
}

// Loud, and never fatal. See the header. The guard lets the test import
// buildPages and injectShell without the script running against dist/.
import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    warn(`skipped: ${error instanceof Error ? error.message : error}`);
    warn("the site still deploys; the crawler copy of the legal pages is missing.");
  }
}
