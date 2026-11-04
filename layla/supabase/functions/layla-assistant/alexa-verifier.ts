import forge from "npm:node-forge@1.3.1";

// Alexa request verification, following Amazon's "Manage Custom Skill
// Requests" rules. The ask-sdk verifier is not used because it relies on
// Node's createVerify() with a certificate PEM, which Deno rejects
// ("invalid PEM public key").

const CERT_HOST = "s3.amazonaws.com";
const CERT_PATH_PREFIX = "/echo.api/";
const CERT_SAN = "echo-api.amazon.com";
const MAX_CERT_BYTES = 64 * 1024;
const CERT_CACHE_TTL_MS = 60 * 60 * 1000;
export const TIMESTAMP_TOLERANCE_MS = 150 * 1000;

type Chain = forge.pki.Certificate[];
const chainCache = new Map<string, { chain: Chain; fetchedAt: number }>();

export class AlexaVerificationError extends Error {}

export function validateCertUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AlexaVerificationError("Certificate URL is not valid");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== CERT_HOST ||
    (url.port !== "" && url.port !== "443") ||
    url.username !== "" || url.password !== "" ||
    !url.pathname.startsWith(CERT_PATH_PREFIX) ||
    url.pathname.split("/").includes("..")
  ) {
    throw new AlexaVerificationError("Certificate URL is not an Alexa URL");
  }
  return url;
}

export function validateTimestamp(
  rawBody: string,
  now = Date.now(),
  toleranceMs = TIMESTAMP_TOLERANCE_MS,
): void {
  let stamp: unknown;
  try {
    stamp = JSON.parse(rawBody)?.request?.timestamp;
  } catch {
    throw new AlexaVerificationError("Request body is not JSON");
  }
  const time = typeof stamp === "string" ? Date.parse(stamp) : NaN;
  if (!Number.isFinite(time)) {
    throw new AlexaVerificationError("Request timestamp is missing");
  }
  if (Math.abs(now - time) > toleranceMs) {
    throw new AlexaVerificationError("Request timestamp is outside tolerance");
  }
}

async function loadChain(url: URL): Promise<Chain> {
  const cached = chainCache.get(url.href);
  if (cached && Date.now() - cached.fetchedAt < CERT_CACHE_TTL_MS) {
    return cached.chain;
  }
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new AlexaVerificationError("Certificate chain could not be loaded");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CERT_BYTES) {
    throw new AlexaVerificationError("Certificate chain has an invalid size");
  }
  const pem = new TextDecoder().decode(bytes);
  const blocks = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );
  if (!blocks || blocks.length === 0 || blocks.length > 5) {
    throw new AlexaVerificationError("Certificate chain is malformed");
  }
  const chain = blocks.map((block) => forge.pki.certificateFromPem(block));
  chainCache.set(url.href, { chain, fetchedAt: Date.now() });
  return chain;
}

function validateChain(chain: Chain, now = new Date()): void {
  for (const cert of chain) {
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      throw new AlexaVerificationError("Certificate expired or not yet valid");
    }
  }
  const san = chain[0].getExtension("subjectAltName") as
    | { altNames?: { value?: string }[] }
    | null;
  if (!san?.altNames?.some((name) => name.value === CERT_SAN)) {
    throw new AlexaVerificationError(`${CERT_SAN} missing from certificate`);
  }
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i + 1].verify(chain[i])) {
      throw new AlexaVerificationError("Certificate chain links are invalid");
    }
  }
}

export async function verifyAlexaSignature(
  rawBody: string,
  headers: Record<string, string>,
): Promise<void> {
  const certUrl = headers["signaturecertchainurl"];
  const sha256 = headers["signature-256"];
  const sha1 = headers["signature"];
  if (!certUrl) throw new AlexaVerificationError("Missing certificate URL");
  if (!sha256 && !sha1) throw new AlexaVerificationError("Missing signature");

  const chain = await loadChain(validateCertUrl(certUrl));
  validateChain(chain);

  const useSha256 = Boolean(sha256);
  const md = useSha256 ? forge.md.sha256.create() : forge.md.sha1.create();
  md.update(forge.util.encodeUtf8(rawBody));
  let signature: string;
  try {
    signature = forge.util.decode64((sha256 ?? sha1)!);
  } catch {
    throw new AlexaVerificationError("Signature is not base64");
  }
  let valid = false;
  try {
    valid = (chain[0].publicKey as forge.pki.rsa.PublicKey).verify(
      md.digest().getBytes(),
      signature,
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new AlexaVerificationError("Request body and signature do not match");
  }
}
