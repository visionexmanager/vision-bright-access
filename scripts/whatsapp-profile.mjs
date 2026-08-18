#!/usr/bin/env node
// Manage the WhatsApp Cloud API business profile from the repository.
//
// The profile is what a customer sees when they tap the business name in
// WhatsApp: the "about" line, the description, the email, the websites, the
// industry. Meta lets it be typed into WhatsApp Manager by hand, which means no
// review, no history, and no way to tell whether what is live still matches
// what anyone agreed to. So the profile lives in
// `supabase/functions/_shared/business-profile.json` and this script is the
// only thing that writes it.
//
//   node scripts/whatsapp-profile.mjs --validate   # no network, no secrets
//   node scripts/whatsapp-profile.mjs --check      # read live, diff, exit 1 on drift
//   node scripts/whatsapp-profile.mjs --push       # write, then read back and diff
//
// --validate is what CI runs: it catches an over-length description or a
// misspelled vertical at review time rather than at push time, and it needs no
// credentials, so it also works on a fork.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { pngSize, squarePng, squarePngProblem } from "./lib/square-png.mjs";

const PROFILE_PATH = "supabase/functions/_shared/business-profile.json";

// Field limits published by Meta for the business profile. They are enforced
// here rather than discovered from a 400, because Graph reports an over-length
// field as a generic parameter error that names neither the field nor by how
// much it overran.
const LIMITS = { about: 139, address: 256, description: 512, email: 128, website: 256 };
const MAX_WEBSITES = 2;

// The industry list Meta accepts. An unlisted value is rejected, and the error
// does not enumerate the valid ones.
const VERTICALS = new Set([
  "UNDEFINED", "OTHER", "AUTO", "BEAUTY", "APPAREL", "EDU", "ENTERTAIN",
  "EVENT_PLAN", "FINANCE", "GROCERY", "GOVT", "HOTEL", "HEALTH", "NONPROFIT",
  "PROF_SERVICES", "RETAIL", "TRAVEL", "RESTAURANT", "NOT_A_BIZ",
]);

// Every Graph field this script writes.
const WRITABLE = ["about", "address", "description", "email", "websites", "vertical"];
const READABLE = [...WRITABLE, "profile_picture_url"];

// Keys in the file that are not Graph fields. `profile_picture` is a path to a
// PNG in this repository: the picture is set by uploading that file and passing
// the handle Meta returns back as `profile_picture_handle`, so the file names
// the source image and the script derives what Graph actually wants.
const LOCAL_ONLY = ["profile_picture"];

// Meta's ceiling for a profile picture. The padded logo is well under it; the
// check exists so a future high-resolution export fails here rather than after
// a multi-megabyte upload.
const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

/**
 * Length as Meta counts it: user-perceived characters, not UTF-16 units.
 *
 * The description is bilingual. A plain `.length` is right for the Arabic —
 * each letter is one unit — but wrong for an emoji, which is two, and the
 * welcome messages in `_shared/whatsapp.ts` already use one, so an emoji is
 * likely to reach this file eventually.
 */
function charCount(text) {
  return [...text].length;
}

function fail(message) {
  console.error(`whatsapp-profile: ${message}`);
  process.exit(1);
}

function readProfile() {
  let raw;
  try {
    raw = readFileSync(PROFILE_PATH, "utf8");
  } catch (error) {
    fail(`cannot read ${PROFILE_PATH}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${PROFILE_PATH} is not valid JSON: ${error.message}`);
  }
}

/** Collect every problem before reporting, so one run fixes one round of edits. */
function validate(profile) {
  const problems = [];

  const known = [...WRITABLE, ...LOCAL_ONLY];
  const unknown = Object.keys(profile).filter((key) => !known.includes(key));
  if (unknown.length) {
    problems.push(`unknown field(s): ${unknown.join(", ")} — Graph ignores these silently`);
  }

  for (const field of ["about", "address", "description", "email"]) {
    const value = profile[field];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      problems.push(`${field} must be a string`);
      continue;
    }
    const length = charCount(value);
    if (length > LIMITS[field]) {
      problems.push(`${field} is ${length} characters, limit is ${LIMITS[field]}`);
    }
  }

  // A clumsy description is cosmetic. A malformed email is printed on the
  // profile as the way to reach the company, so it is checked.
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    problems.push(`email does not look like an address: ${profile.email}`);
  }

  const websites = profile.websites ?? [];
  if (!Array.isArray(websites)) {
    problems.push("websites must be an array");
  } else {
    if (websites.length > MAX_WEBSITES) {
      problems.push(`${websites.length} websites listed, Meta accepts at most ${MAX_WEBSITES}`);
    }
    for (const site of websites) {
      if (typeof site !== "string" || !site.startsWith("https://")) {
        problems.push(`website must be an https:// URL: ${site}`);
      } else if (charCount(site) > LIMITS.website) {
        problems.push(`website is over ${LIMITS.website} characters: ${site}`);
      }
    }
  }

  if (profile.vertical !== undefined && !VERTICALS.has(profile.vertical)) {
    problems.push(
      `vertical "${profile.vertical}" is not one Meta accepts. Valid: ${[...VERTICALS].join(", ")}`,
    );
  }

  // The picture is checked here, offline, because the alternative is finding
  // out that the logo cannot be squared halfway through a manual publish.
  if (profile.profile_picture !== undefined) {
    try {
      const padded = readPicture(profile.profile_picture);
      if (padded.length > MAX_PICTURE_BYTES) {
        problems.push(
          `the squared logo is ${(padded.length / 1024 / 1024).toFixed(1)} MB, over Meta's 5 MB limit`,
        );
      }
    } catch (error) {
      problems.push(`profile_picture ${profile.profile_picture}: ${error.message}`);
    }
  }

  return problems;
}

/**
 * Load the logo and pad it to the square WhatsApp requires.
 *
 * The squared image is derived on every run rather than committed next to the
 * original. A second copy of the logo is a second thing to update, and the one
 * that never gets updated is the one nobody looks at — which is exactly what a
 * WhatsApp profile picture is.
 */
function readPicture(path) {
  const source = readFileSync(path);
  const problem = squarePngProblem(source);
  if (problem) throw new Error(problem);
  return squarePng(source);
}

function credentials({ needsAppId = false } = {}) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  // The upload session is opened against the Meta *app*, not the phone number
  // — the Resumable Upload API belongs to Graph rather than to WhatsApp — so
  // publishing a picture needs one more identifier than the text fields do.
  const appId = process.env.META_APP_ID;
  const missing = [
    !token && "WHATSAPP_TOKEN",
    !phoneNumberId && "WHATSAPP_PHONE_NUMBER_ID",
    needsAppId && !appId && "META_APP_ID",
  ].filter(Boolean);
  if (missing.length) {
    fail(
      `${missing.join(" and ")} not set. These are repository secrets — run this through ` +
      `.github/workflows/whatsapp-profile.yml rather than pasting a token into a shell.`,
    );
  }
  // Mirrors the default in supabase/functions/_shared/meta.ts, and honours the
  // same override name, so a retired Graph version moves in one place.
  const version = process.env.META_GRAPH_API_VERSION ?? "v26.0";
  return { token, phoneNumberId, appId, base: `https://graph.facebook.com/${version}` };
}

/**
 * Graph puts the failure in a JSON body, but answers a wrong or expired token
 * with a body that also echoes the request. Only the message and code are
 * surfaced, never the response as a whole.
 */
async function graphError(response) {
  let detail = `HTTP ${response.status}`;
  try {
    const body = await response.json();
    const error = body?.error;
    if (error?.message) detail = `${error.message} (code ${error.code ?? "?"})`;
  } catch {
    // A non-JSON body from an edge proxy; the status is all there is.
  }
  return detail;
}

async function fetchLive({ token, phoneNumberId, base }) {
  const url = `${base}/${phoneNumberId}/whatsapp_business_profile?fields=${READABLE.join(",")}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) fail(`could not read the live profile: ${await graphError(response)}`);
  const body = await response.json();
  // The profile comes back as a one-element array even though a phone number
  // has exactly one profile.
  return body?.data?.[0] ?? {};
}

/**
 * POST to Graph, trying both spellings of the authorization header.
 *
 * The Resumable Upload API is documented with `Authorization: OAuth <token>`
 * while every other Graph call in this repository sends `Bearer`. Which one an
 * endpoint accepts is not something to discover from a failed manual publish,
 * so both are tried and the first response that is not an authorization
 * failure is the answer.
 */
async function postWithAuth(url, token, init = {}) {
  let firstFailure = null;
  for (const scheme of ["OAuth", "Bearer"]) {
    const response = await fetch(url, {
      ...init,
      method: "POST",
      headers: { ...init.headers, Authorization: `${scheme} ${token}` },
    });
    if (response.ok) return response;
    const detail = await graphError(response);
    firstFailure ??= detail;
    // 401 and Graph's code 190 both mean "this credential was not accepted",
    // which is the only failure the other spelling could fix.
    if (response.status !== 401 && !detail.includes("code 190")) return { ok: false, detail };
  }
  return { ok: false, detail: firstFailure };
}

/**
 * Upload the logo and return the handle that sets it as the profile picture.
 *
 * Two round trips: one to open an upload session against the Meta app, one to
 * send the bytes. The handle that comes back is single-use and is not the
 * `profile_picture_url` that reading the profile returns, so there is nothing
 * to compare against afterwards — `--check` can only report whether a picture
 * is set at all.
 */
async function uploadPicture({ token, appId, base }, image) {
  const query = new URLSearchParams({
    file_name: "visionex-logo.png",
    file_length: String(image.length),
    file_type: "image/png",
  });
  const opened = await postWithAuth(`${base}/${appId}/uploads?${query}`, token);
  if (!opened.ok) fail(`could not open an upload session: ${opened.detail}`);

  const { id } = await opened.json();
  if (!id) fail("the upload session came back without an id");

  const sent = await postWithAuth(`${base}/${id}`, token, {
    headers: { file_offset: "0", "Content-Type": "application/octet-stream" },
    body: image,
  });
  if (!sent.ok) fail(`the logo was not accepted: ${sent.detail}`);

  const { h } = await sent.json();
  if (!h) fail("the upload finished without returning a file handle");
  return h;
}

async function pushProfile({ token, phoneNumberId, base }, profile, pictureHandle) {
  // Empty values are left out rather than sent as "". Meta treats a field it
  // was not given as unchanged, and whether "" clears a field or is rejected is
  // not documented — so clearing is deliberately left to WhatsApp Manager, and
  // the diff below reports anything set live but empty here.
  const payload = { messaging_product: "whatsapp" };
  for (const field of WRITABLE) {
    const value = profile[field];
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    payload[field] = value;
  }
  if (pictureHandle) payload.profile_picture_handle = pictureHandle;

  const response = await fetch(`${base}/${phoneNumberId}/whatsapp_business_profile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) fail(`the profile was not accepted: ${await graphError(response)}`);
  return Object.keys(payload).filter((key) => key !== "messaging_product");
}

/**
 * Meta stores a URL canonicalised, not as it was sent: `https://visionex.app`
 * comes back as `https://visionex.app/`. Compared as strings that is drift
 * that no edit can settle — the file would have to be written in whatever form
 * Meta happens to normalise to, and the next rule it applies would break it
 * again. So websites are compared as URLs. `new URL().href` performs the same
 * canonicalisation, including the trailing slash on a bare origin.
 */
export function canonicalUrl(value) {
  try {
    return new URL(value).href;
  } catch {
    // Not parseable as a URL — compare it as written and let the diff say so.
    return value;
  }
}

export function normalise(field, value) {
  if (field === "websites") {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return list.map(canonicalUrl).join("\n");
  }
  if (Array.isArray(value)) return value.join("\n");
  return value === undefined || value === null ? "" : String(value);
}

/** Report the live profile against the file. Returns the number of differences. */
function diff(local, live) {
  let differences = 0;

  for (const field of WRITABLE) {
    const wanted = normalise(field, local[field]);
    const actual = normalise(field, live[field]);
    if (wanted === actual) {
      console.log(`  = ${field}: matches`);
      continue;
    }
    differences += 1;
    if (wanted === "") {
      console.log(`  ! ${field}: empty in the file but set live — clear it in WhatsApp Manager`);
    } else {
      console.log(`  ! ${field}: differs`);
      console.log(`      file: ${JSON.stringify(wanted)}`);
      console.log(`      live: ${JSON.stringify(actual)}`);
    }
  }

  // The picture cannot be compared: reading the profile returns a CDN URL,
  // writing it takes a single-use upload handle, and neither is derivable from
  // the other. Presence is all there is to report, and a picture that is set
  // but stale is not drift this can see — run --push to be sure.
  if (live.profile_picture_url) {
    console.log("  = profile_picture_url: set");
  } else if (local.profile_picture) {
    console.log(`  ! profile_picture_url: not set — --push uploads ${local.profile_picture}`);
    differences += 1;
  } else {
    console.log("  ! profile_picture_url: not set, and no profile_picture in the file");
  }

  return differences;
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  const mode = flags.has("--push") ? "push" : flags.has("--check") ? "check" : "validate";

  const profile = readProfile();
  const problems = validate(profile);
  if (problems.length) {
    console.error(`whatsapp-profile: ${PROFILE_PATH} is not valid:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`${PROFILE_PATH} is valid:`);
  for (const field of ["about", "description", "email", "address"]) {
    const value = profile[field] ?? "";
    console.log(`  ${field}: ${value === "" ? "(empty)" : `${charCount(value)}/${LIMITS[field]} chars`}`);
  }
  console.log(`  websites: ${(profile.websites ?? []).length}/${MAX_WEBSITES}`);
  console.log(`  vertical: ${profile.vertical ?? "(unset)"}`);

  const picture = profile.profile_picture ? readPicture(profile.profile_picture) : null;
  if (picture) {
    const { width, height } = pngSize(picture);
    const source = pngSize(readFileSync(profile.profile_picture));
    console.log(
      `  profile_picture: ${profile.profile_picture} — ${source.width}x${source.height} ` +
      `padded to ${width}x${height}, ${(picture.length / 1024).toFixed(0)} KB`,
    );
  }

  if (mode === "validate") return;

  const auth = credentials({ needsAppId: mode === "push" && picture !== null });

  if (mode === "push") {
    // Uploaded before the profile write, because the handle is one of the
    // fields that write carries. A failed upload therefore changes nothing.
    const handle = picture ? await uploadPicture(auth, picture) : null;
    const sent = await pushProfile(auth, profile, handle);
    console.log(`\npushed: ${sent.join(", ")}`);
  }

  console.log("\nlive profile:");
  const live = await fetchLive(auth);
  const differences = diff(profile, live);

  if (differences === 0) {
    console.log("\nthe live profile matches the file.");
    return;
  }
  if (mode === "push") {
    fail(`${differences} field(s) did not take effect — Meta accepted the write but the read back disagrees.`);
  }
  console.log(`\n${differences} field(s) differ. Run with --push to apply the file.`);
  process.exit(1);
}

// Run only when invoked directly. Exporting the comparison helpers lets them
// be unit tested, and an import that also fired a publish would be a trap.
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
