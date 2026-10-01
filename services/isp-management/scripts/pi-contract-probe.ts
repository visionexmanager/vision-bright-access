/**
 * READ-ONLY probe of the PI/Proradius API. Performs GET requests only, against a
 * fixed list of paths, and prints each response's SHAPE (keys and types, never
 * values). Use it with a dedicated read-only PI account to replace the field
 * guesses in src/providers/pi/mapper.ts with facts.
 *
 *   PI_BASE_URL=... PI_USERNAME=... PI_PASSWORD=... [PI_TOTP_SECRET=...] \
 *     npx tsx scripts/pi-contract-probe.ts <test-username>
 *
 * Credentials come from the environment only and are never printed.
 */
import { PiClient } from "../src/providers/pi/client.js";
import { PI_CONTRACT } from "../src/providers/pi/provider.js";
import { shapeOf } from "../src/providers/pi/shape.js";

const user = process.argv[2];
const { PI_BASE_URL, PI_USERNAME, PI_PASSWORD, PI_TOTP_SECRET } = process.env;
if (!user || !PI_BASE_URL || !PI_USERNAME || !PI_PASSWORD) {
  console.error("usage: PI_BASE_URL PI_USERNAME PI_PASSWORD [PI_TOTP_SECRET] npx tsx scripts/pi-contract-probe.ts <test-username>");
  process.exit(2);
}
const c = PI_CONTRACT;
const client = new PiClient({ baseUrl: PI_BASE_URL.replace(/\/$/, ""), username: PI_USERNAME, password: PI_PASSWORD, totpSecret: PI_TOTP_SECRET });
const probes: [string, string, Record<string, string>?][] = [
  ["stats", c.stats.path],
  ["users list (search)", c.usersList.path, { [c.usersList.searchParam]: user, [c.usersList.sizeParam]: "3" }],
  ["user get", c.userGet.path, { [c.userGet.idParam]: user }],
  ["user overview", c.userOverview.path, { [c.userOverview.idParam]: user }],
  ["user invoices", c.userInvoices.path, { [c.userInvoices.idParam]: user }],
  ["user refills", c.userRefills.path, { [c.userRefills.idParam]: user }],
  ["sessions list", c.sessionsList.path, { [c.sessionsList.userParam]: user }],
];
for (const [name, path, query] of probes) {
  try {
    const body = await client.get(path, query);
    console.log(`\n## ${name}  GET ${path}${query ? "?" + Object.keys(query).join("&") : ""}`);
    console.log(JSON.stringify(shapeOf(body), null, 2));
  } catch (e) {
    console.log(`\n## ${name}  GET ${path}  -> ${(e as Error).message}`);
  }
}
