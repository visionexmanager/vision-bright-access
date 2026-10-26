import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Arabic and English in one recording: the text is cut by script and each run is
// spoken by the voice that knows it. These guard the cut, the refusals and the way
// the service is built and deployed.

const server = readFileSync("services/local-tts/server.py", "utf8");
const dockerfile = readFileSync("services/local-tts/Dockerfile", "utf8");
const fetcher = readFileSync("services/local-tts/fetch_voices.py", "utf8");
const deploy = readFileSync(".github/workflows/deploy-local-tts.yml", "utf8");

const python = ["python3", "python"].find((bin) => spawnSync(bin, ["--version"]).status === 0);

function run(code: string): string {
  const r = spawnSync(python!, ["-c", `import sys, json; sys.path.insert(0, "services/local-tts"); import server\n${code}`], {
    encoding: "utf8",
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim();
}

describe.skipIf(!python)("the cut and the refusals (needs python on the machine)", () => {
  it("speaks Latin runs in English and the rest in Arabic", () => {
    const out = JSON.parse(run('print(json.dumps(server.split_runs("مرحبا بكم في Visionex، منصة تجمع الأخبار على Facebook و Instagram.")))'));
    expect(out.map(([lang]: [string]) => lang)).toEqual(["ar", "en", "ar", "en", "ar", "en"]);
    expect(out[1][1]).toBe("Visionex");
    expect(out[3][1]).toBe("Facebook");
    expect(out[5][1]).toBe("Instagram");
    // The full stop after the name is not part of it.
    expect(out.length).toBe(6);
  });

  it("keeps a multi-word English name as one run and drops pieces with nothing to say", () => {
    const out = JSON.parse(run('print(json.dumps(server.split_runs("عبر WhatsApp Business ، !!")))'));
    expect(out.map(([lang, text]: [string, string]) => `${lang}:${text.trim()}`)).toEqual(["ar:عبر", "en:WhatsApp Business"]);
  });

  it("refuses a script it has no voice for, so the caller can use another provider", () => {
    expect(run('print(server.unsupported("Привет"))')).toBe("True");
    expect(run('print(server.unsupported("你好"))')).toBe("True");
    expect(run('print(server.unsupported("café"))')).toBe("True");
    expect(run('print(server.unsupported("مرحبا Visionex 962 7"))')).toBe("False");
  });
});

describe("what the service promises", () => {
  it("speaks Arabic at the pace the owner chose and English at the default", () => {
    expect(server).toMatch(/LENGTH_SCALE = \{"ar": 0\.65, "en": 1\.0\}/);
  });

  it("never logs the text, only a length and an outcome", () => {
    expect(server).toContain('print(f"speak chars={len(text)} ok={wav is not None}');
    expect(server).not.toMatch(/print\([^)]*\btext\b(?!\))[^)]*\)(?![^\n]*chars=)/);
    expect(server).toMatch(/def log_message[^\n]*\n\s+pass/);
  });

  it("caps the body, the text and the number of syntheses at once, and checks the token in constant time", () => {
    expect(server).toContain("MAX_BODY_BYTES = 8 * 1024");
    expect(server).toContain("MAX_TEXT_CHARS = 1200");
    expect(server).toContain("MAX_CONCURRENT = 2");
    expect(server).toContain("hmac.compare_digest");
  });

  it("pins the voices by commit and by SHA-256 and runs as a non-root user", () => {
    expect(fetcher).toMatch(/REV = "[0-9a-f]{40}"/);
    expect(fetcher.match(/"[0-9a-f]{64}"/g)?.length).toBe(2);
    expect(fetcher).toContain("does not match its pinned SHA-256");
    expect(dockerfile).toMatch(/piper-tts==\d+\.\d+\.\d+/);
    expect(dockerfile).toMatch(/USER 10001/);
  });
});

describe("the deployment", () => {
  it("publishes to loopback only, read-only, without capabilities, and never touches nginx", () => {
    expect(deploy).toContain("--publish 127.0.0.1:8090:8090");
    expect(deploy).toContain("--read-only");
    expect(deploy).toContain("--cap-drop ALL");
    expect(deploy).toContain("--security-opt no-new-privileges");
    expect(deploy).not.toMatch(/nginx\s+-s|systemctl|sites-enabled\//);
  });

  it("delivers the token through a file Docker consumes, not through argv", () => {
    expect(deploy).toContain("--env-file ~/.visionex-tts.env");
    expect(deploy).toContain("umask 077");
    expect(deploy).not.toMatch(/--env\s+TTS_TOKEN/);
    expect(deploy).not.toMatch(/docker run[^\n]*TOKEN=/);
  });

  it("proves the refusals as well as the speech", () => {
    for (const expectation of ["(expect 401)", "(expect 400)", "(expect 422)", "(expect 413)"]) {
      expect(deploy).toContain(expectation);
    }
    expect(deploy).toContain("RIFF");
  });
});
