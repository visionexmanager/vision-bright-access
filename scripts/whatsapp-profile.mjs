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

// Every field this script owns. profile_picture_url is read but never written:
// setting the picture needs a resumable upload handle, which is a different
// flow, done once in WhatsApp Manager.
const WRITABLE = ["about", "address", "description", "email", "websites", "vertical"];
const READABLE = [...WRITABLE, "profile_picture_url"];

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

  const unknown = Object.keys(profile).filter((key) => !WRITABLE.includes(key));
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

  return problems;
}

function credentials() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const missing = [
    !token && "WHATSAPP_TOKEN",
    !phoneNumberId && "WHATSAPP_PHONE_NUMBER_ID",
  ].filter(Boolean);
  if (missing.length) {
    fail(
      `${missing.join(" and ")} not set. Both are repository secrets — run this through ` +
      `.github/workflows/whatsapp-profile.yml rather than pasting a token into a shell.`,
    );
  }
  // Mirrors the default in supabase/functions/_shared/meta.ts, and honours the
  // same override name, so a retired Graph version moves in one place.
  const version = process.env.META_GRAPH_API_VERSION ?? "v26.0";
  return { token, phoneNumberId, base: `https://graph.facebook.com/${version}` };
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

async function pushProfile({ token, phoneNumberId, base }, profile) {
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

  const response = await fetch(`${base}/${phoneNumberId}/whatsapp_business_profile`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) fail(`the profile was not accepted: ${await graphError(response)}`);
  return Object.keys(payload).filter((key) => key !== "messaging_product");
}

function normalise(value) {
  if (Array.isArray(value)) return value.join("\n");
  return value === undefined || value === null ? "" : String(value);
}

/** Report the live profile against the file. Returns the number of differences. */
function diff(local, live) {
  let differences = 0;

  for (const field of WRITABLE) {
    const wanted = normalise(local[field]);
    const actual = normalise(live[field]);
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

  if (live.profile_picture_url) {
    console.log("  = profile_picture_url: set (managed in WhatsApp Manager, not here)");
  } else {
    console.log("  ! profile_picture_url: not set — upload the logo in WhatsApp Manager");
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

  if (mode === "validate") return;

  const auth = credentials();

  if (mode === "push") {
    const sent = await pushProfile(auth, profile);
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

await main();
