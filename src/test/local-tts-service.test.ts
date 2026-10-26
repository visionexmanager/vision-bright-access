import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Arabic and English in one recording: the text is cut by script and each run is
// spoken by the voice that knows it. These guard the cut, the refusals and the way
// the service is built and deployed.

const server = readFileSync("services/local-tts/server.py", "utf8");
const dockerfile = readFileSync("services/local-tts/Dockerfile", "utf8");
const fetcher = readFileSync("services/local-tts/fetch_voices.py", "utf8");
const lock = JSON.parse(readFileSync("services/local-tts/voices.json", "utf8")) as {
  revision: string;
  voices: Record<string, { sha256: string; script: string; length_scale: number; onnx: string }>;
};
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
    const out = JSON.parse(run('print(json.dumps(server.split_runs("مرحبا بكم في Visionex، منصة تجمع الأخبار على Facebook و Instagram.", "ar")))'));
    expect(out.map(([lang]: [string]) => lang)).toEqual(["ar", "en", "ar", "en", "ar", "en"]);
    expect(out[1][1]).toBe("Visionex");
    expect(out[3][1]).toBe("Facebook");
    expect(out[5][1]).toBe("Instagram");
    // The full stop after the name is not part of it.
    expect(out.length).toBe(6);
  });

  it("keeps a multi-word English name as one run and drops pieces with nothing to say", () => {
    const out = JSON.parse(run('print(json.dumps(server.split_runs("عبر WhatsApp Business ، !!", "ar")))'));
    expect(out.map(([lang, text]: [string, string]) => `${lang}:${text.trim()}`)).toEqual(["ar:عبر", "en:WhatsApp Business"]);
  });

  it("refuses a script the chosen language does not use, so the caller can use another provider", () => {
    expect(run('print(server.unsupported("Привет", "ar"))')).toBe("True");
    expect(run('print(server.unsupported("你好", "ar"))')).toBe("True");
    expect(run('print(server.unsupported("नमस्ते", "ar"))')).toBe("True");
    expect(run('print(server.unsupported("مرحبا Visionex 962 7", "ar"))')).toBe("False");
    expect(run('print(server.unsupported("Привет, Visionex", "ru"))')).toBe("False");
    expect(run('print(server.unsupported("Привет", "fr"))')).toBe("True");
    expect(run('print(server.unsupported("café à Genève", "fr"))')).toBe("False");
    expect(run('print(server.unsupported("Chào mừng bạn đến với Visionex", "vi"))')).toBe("False");
    expect(run('print(server.unsupported("Visionex에 오신 것을 환영합니다", "ko"))')).toBe("False");
    expect(run('print(server.unsupported("Visionex में आपका स्वागत है", "hi"))')).toBe("False");
  });

  it("hands a Latin-script language to its own voice whole, and the Latin runs of the others to English", () => {
    expect(JSON.parse(run('print(json.dumps(server.split_runs("Bienvenue sur Visionex et Facebook.", "fr")))'))).toEqual([["fr", "Bienvenue sur Visionex et Facebook."]]);
    expect(JSON.parse(run('print(json.dumps(server.split_runs("Добро пожаловать в Visionex.", "ru")))')).map(([v]: [string]) => v)).toEqual(["ru", "en"]);
    expect(JSON.parse(run('print(json.dumps(server.split_runs("به Visionex خوش آمدید", "fa")))')).map(([v]: [string]) => v)).toEqual(["fa", "en", "fa"]);
  });

  it("knows exactly the eighteen languages in the lock and normalises codes", () => {
    expect(JSON.parse(run("print(json.dumps(sorted(server.VOICES)))"))).toEqual(Object.keys(lock.voices).sort());
    expect(run('print(server.normalise_language("pt-BR"), server.normalise_language("AR"), server.normalise_language(None))')).toBe("pt ar");
  });
});

describe("what the service promises", () => {
  it("speaks Arabic at the pace the owner chose and every other language at the default", () => {
    expect(lock.voices.ar.length_scale).toBe(0.65);
    for (const [lang, voice] of Object.entries(lock.voices)) {
      if (lang !== "ar") expect(voice.length_scale, lang).toBe(1.0);
    }
  });

  it("covers eighteen languages, each pinned by SHA-256 and a known script", () => {
    expect(Object.keys(lock.voices).sort()).toEqual(
      ["ar", "bn", "de", "en", "es", "fa", "fr", "hi", "id", "it", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi"],
    );
    for (const [lang, voice] of Object.entries(lock.voices)) {
      expect(voice.sha256, lang).toMatch(/^[0-9a-f]{64}$/);
      expect(["latin", "arabic", "bengali", "devanagari", "cyrillic", "hangul"], lang).toContain(voice.script);
    }
    expect(lock.voices.en.script).toBe("latin");
  });

  it("never logs the text, only a length and an outcome", () => {
    expect(server).toContain('print(f"speak lang={lang} chars={len(text)} ok={wav is not None}');
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
    expect(lock.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(fetcher).toContain("does not match its pinned SHA-256");
    expect(fetcher).toContain("voices.json");
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

  it("speaks a greeting in every language of the lock during the self-test", () => {
    for (const lang of Object.keys(lock.voices)) {
      expect(deploy, lang).toMatch(new RegExp(String.raw`^\s+${lang}\|`, "m"));
    }
    expect(deploy).toContain('[ "$FAIL" -eq 0 ]');
  });

  it("proves the refusals as well as the speech", () => {
    for (const expectation of ["(expect 401)", "(expect 400)", "(expect 422)", "(expect 413)"]) {
      expect(deploy).toContain(expectation);
    }
    expect(deploy).toContain("RIFF");
  });
});
