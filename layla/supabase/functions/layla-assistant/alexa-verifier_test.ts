import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import forge from "npm:node-forge@1.3.1";
import {
  AlexaVerificationError,
  validateCertUrl,
  validateTimestamp,
  verifyAlexaSignature,
} from "./alexa-verifier.ts";

Deno.test("accepts only Amazon's echo.api certificate URLs", () => {
  validateCertUrl("https://s3.amazonaws.com/echo.api/echo-api-cert-7.pem");
  validateCertUrl("https://S3.AMAZONAWS.COM:443/echo.api/echo-api-cert.pem");
  for (
    const bad of [
      "http://s3.amazonaws.com/echo.api/cert.pem",
      "https://s3.amazonaws.com.evil.com/echo.api/cert.pem",
      "https://s3.amazonaws.com/other/cert.pem",
      "https://s3.amazonaws.com:8443/echo.api/cert.pem",
      "https://s3.amazonaws.com/echo.api/../cert.pem",
      "https://user@s3.amazonaws.com/echo.api/cert.pem",
      "not a url",
    ]
  ) {
    assertThrows(() => validateCertUrl(bad), AlexaVerificationError, "", bad);
  }
});

Deno.test("timestamp must be present and within 150 seconds", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  const body = (stamp: string) =>
    JSON.stringify({ request: { timestamp: stamp } });
  validateTimestamp(body("2026-11-04T11:58:00Z"), now);
  validateTimestamp(body("2026-11-04T12:01:00Z"), now);
  assertThrows(() => validateTimestamp(body("2026-11-04T11:55:00Z"), now));
  assertThrows(() => validateTimestamp(body("2026-11-04T12:05:00Z"), now));
  assertThrows(() => validateTimestamp("{}", now));
  assertThrows(() => validateTimestamp("not json", now));
});

Deno.test("rejects requests with missing or hostile signature headers", async () => {
  for (
    const headers of <Record<string, string>[]> [
      {},
      { "signature-256": "AAAA" },
      { signaturecertchainurl: "https://s3.amazonaws.com/echo.api/c.pem" },
      {
        "signature-256": "AAAA",
        signaturecertchainurl: "https://evil.example/echo.api/c.pem",
      },
    ]
  ) {
    let failed = false;
    try {
      await verifyAlexaSignature("{}", headers);
    } catch (error) {
      failed = error instanceof AlexaVerificationError;
    }
    assertEquals(failed, true, JSON.stringify(headers));
  }
});

Deno.test("node-forge verifies an RSA SHA-256 signature and rejects a forged one", () => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const body = JSON.stringify({ request: { type: "LaunchRequest" } });
  const md = forge.md.sha256.create();
  md.update(forge.util.encodeUtf8(body));
  const signature = keys.privateKey.sign(md);

  const check = (text: string, sig: string) => {
    const digest = forge.md.sha256.create();
    digest.update(forge.util.encodeUtf8(text));
    return keys.publicKey.verify(digest.digest().getBytes(), sig);
  };
  assertEquals(check(body, signature), true);
  assertEquals(check(body + " ", signature), false);
});
