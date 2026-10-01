import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const svc = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(svc, "deploy", "ci-pi-check");
const wfPath = join(svc, "..", "..", ".github", "workflows", "isp-pi-check.yml");
const read = (p: string) => readFileSync(p, "utf8").replaceAll("\r\n", "\n");
const wf = read(wfPath);
const code = (s: string) => s.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"); // drop comment lines

// ---------- the workflow cannot ask for an arbitrary command ----------
describe("workflow: static proof it cannot request an arbitrary command", () => {
  const body = code(wf);

  it("sends exactly one thing over SSH: a literal word chosen by if/else", () => {
    const sshLines = body.split("\n").filter((l) => /(^|[\s;|&(])(ssh|scp|sftp|rsync|sshpass)\s/.test(l) && !/^\s*(Host|HostName)/.test(l));
    expect(sshLines).toHaveLength(1);
    expect(sshLines[0]!.trim()).toBe('ssh -T target "$MODE" < /dev/null 2>/dev/null > "$RUNNER_TEMP/raw.txt"');
    const assigns = body.match(/MODE=\S+/g) ?? [];
    expect(assigns.sort()).toEqual(["MODE=check;", "MODE=probe;"]);
    expect(body).toMatch(/if \[ "\$PROBE" = "true" \]; then MODE=probe; else MODE=check; fi/);
  });

  it("interpolates no expression into any script: ${{ }} appears only as an env value", () => {
    const exprs = body.split("\n").filter((l) => l.includes("${{"));
    expect(exprs.length).toBeGreaterThan(0);
    for (const l of exprs) {
      expect(l.trim(), l).toMatch(/^([A-Z_]+: \$\{\{ (secrets\.(SERVER_HOST|ISP_PI_CHECK_SSH_KEY|ISP_PI_CHECK_HOST_KEY)|inputs\.probe) \}\}|if: (success|always)\(\))$/);
    }
    expect(wf.match(/\binputs\./g)?.length).toBe(1);
  });

  it("has a single boolean input and no free text", () => {
    const inputs = wf.slice(wf.indexOf("inputs:"), wf.indexOf("permissions:"));
    expect(inputs).toMatch(/type: boolean/);
    expect(inputs).not.toMatch(/type: (string|choice|number)/);
    expect((inputs.match(/^\s{6}[a-z_]+:\s*$/gm) ?? []).length).toBe(1);
  });

  it("uses the dedicated key and account, never the general admin key", () => {
    expect(wf).toContain("User isp-ci");
    expect(wf).toContain("secrets.ISP_PI_CHECK_SSH_KEY");
    expect(wf).not.toMatch(/secrets\.(SSH_PRIVATE_KEY|SERVER_USER)/);
    const used = [...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]).sort();
    expect([...new Set(used)]).toEqual(["ISP_PI_CHECK_HOST_KEY", "ISP_PI_CHECK_SSH_KEY", "SERVER_HOST"]);
  });

  it("asks the SSH client for no tty, forwarding or environment", () => {
    for (const o of ["RequestTTY no", "ForwardAgent no", "ForwardX11 no", "ClearAllForwardings yes", "SendEnv -*", "BatchMode yes", "IdentitiesOnly yes"]) expect(wf).toContain(o);
  });

  it("contains no privileged, shell, container or server-changing command", () => {
    expect(body).not.toMatch(/\bsudo\b|\bnode\b|\bbash -c\b|\bsh -c\b|\beval\b|docker|systemctl|ufw|iptables|psql|supabase|certbot|nginx|\bcat \/etc|printenv|set -x|xtrace/);
    expect(body).not.toMatch(/\benv\b\s*\|/);
  });

  it("runs only from main with read-only repository permissions, and builds nothing it sends", () => {
    expect(wf).toMatch(/if: github\.ref == 'refs\/heads\/main'/);
    expect(wf).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(body).not.toMatch(/esbuild|npm (ci|i)\b|checkout/); // the program on the server is not supplied by the workflow
  });

  it("filters output through the closed vocabulary and discards stderr", () => {
    expect(body).toMatch(/2>\/dev\/null/);
    expect(body).toMatch(/grep -E '\^\(env file\|PI base URL\|PI route/);
  });
});

// ---------- the server-side restriction ----------
describe("authorized_keys restriction", () => {
  const line = read(join(dir, "authorized_keys.template")).trimEnd();
  const m = /^(\S+) (ssh-ed25519) (\S+) (\S+)$/.exec(line);
  const opts = m![1]!;

  it("is exactly one line with the forced command and every capability switched off", () => {
    expect(line.split("\n")).toHaveLength(1);
    expect(m).not.toBeNull();
    expect(opts).toBe('restrict,command="/usr/local/sbin/isp-pi-check-entry",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc');
  });
  it("grants nothing extra (no permit-*, environment=, tunnel, cert-authority)", () => {
    expect(opts).not.toMatch(/permit|environment|tunnel|cert-authority|principals|expiry/i);
    expect(opts.match(/command="/g)).toHaveLength(1);
  });
});

describe("sudoers rule", () => {
  const lines = read(join(dir, "sudoers.isp-pi-check")).split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  it("allows exactly two exact command lines for isp-ci, nothing else", () => {
    expect(lines).toContain("Cmnd_Alias ISP_PI_CHECK = /usr/local/sbin/isp-pi-check-run check, /usr/local/sbin/isp-pi-check-run probe");
    expect(lines).toContain("isp-ci ALL=(root) NOPASSWD: ISP_PI_CHECK");
    for (const l of lines) expect(l, l).toMatch(/^(Cmnd_Alias ISP_PI_CHECK =|Defaults:isp-ci |isp-ci ALL=\(root\) NOPASSWD: ISP_PI_CHECK$)/);
  });
  it("has no wildcard, no ALL command, no shell, no SETENV, no editor", () => {
    const text = lines.join("\n");
    expect(text).not.toMatch(/\*|NOPASSWD:\s*ALL|SETENV\b(?!\s*$)|\b(sh|bash|dash|zsh|su|env|vi|vim|nano|less|more|find|awk|python|perl|node|docker)\b/);
    expect(text).toContain("!setenv");
    expect(text).toContain("env_reset");
    expect(lines.filter((l) => l.startsWith("isp-ci "))).toHaveLength(1);
  });
});

// ---------- the scripts, executed ----------
function bashOk(): boolean {
  const r = spawnSync("bash", ["-c", "command -v flock >/dev/null && command -v sha256sum >/dev/null && command -v stat >/dev/null"]);
  return r.status === 0;
}
const runnable = bashOk();

describe("entry point: SSH_ORIGINAL_COMMAND is data, never executed", () => {
  const src = read(join(dir, "isp-pi-check-entry"));
  it("has no eval, command substitution, backticks or shell re-entry", () => {
    const body = code(src);
    expect(body).not.toMatch(/\beval\b|`|\$\(|\bsh -c\b|\bbash -c\b|\bsource\b|^\s*\.\s/m);
    expect(body.match(/SSH_ORIGINAL_COMMAND/g)).toHaveLength(1); // used once, in the case word-match
    expect(body).toMatch(/exec \/usr\/bin\/sudo -n \/usr\/local\/sbin\/isp-pi-check-run "\$MODE"/);
  });

  it.runIf(runnable)("forwards only the two literal words; every other string is refused without calling sudo", () => {
    const tmp = mkdtempSync(join(tmpdir(), "entry-"));
    const stub = join(tmp, "sudo");
    writeFileSync(stub, '#!/bin/sh\necho "SUDO-CALLED $*"\n');
    chmodSync(stub, 0o755);
    const script = join(tmp, "entry");
    writeFileSync(script, src.replace("/usr/bin/sudo", stub.replaceAll("\\", "/")));
    const run = (cmd?: string) => spawnSync("sh", [script], { env: cmd === undefined ? {} : { SSH_ORIGINAL_COMMAND: cmd }, encoding: "utf8" });

    expect(run("check").stdout.trim()).toBe("SUDO-CALLED -n /usr/local/sbin/isp-pi-check-run check");
    expect(run("probe").stdout.trim()).toBe("SUDO-CALLED -n /usr/local/sbin/isp-pi-check-run probe");

    const hostile = [
      undefined, "", " ", "CHECK", "Probe", "check ", " check", "check\n", "check\nid", "check; id", "check && id", "check | id", "check `id`", "check $(id)", "$(id)", "`id`",
      "probe --x", "check probe", "--probe", "-n", "id", "bash", "sh -c id", "cat /etc/visionex-isp/isp.env", "scp -t /tmp", "internal-sftp", "../check", "chec", "checkk",
      "check\tid", "check'id'", 'check"id"', "check#", "check\\", "*", "c*", "${IFS}", "check${IFS}id",
    ];
    for (const h of hostile) {
      const r = run(h);
      expect(r.status, JSON.stringify(h)).toBe(2);
      expect(r.stdout, JSON.stringify(h)).toBe("");
      expect(r.stdout + r.stderr).not.toContain("SUDO-CALLED");
    }
  });
});

describe("privileged runner: refuses anything but the pinned bundle with two fixed arguments", () => {
  const src = read(join(dir, "isp-pi-check-run"));
  const flockPath = spawnSync("bash", ["-c", "command -v flock"], { encoding: "utf8" }).stdout.trim() || "/usr/bin/flock";
  const asLocal = (s: string) => s.replace("/usr/bin/flock", flockPath); // the only tool path that differs between the test host and Ubuntu
  const bundle = read(join(dir, "pi-check.mjs"));

  it("has no eval/shell re-entry and runs node with an empty environment, stderr discarded", () => {
    const body = code(src);
    expect(body).not.toMatch(/\beval\b|\bsh -c\b|\bbash -c\b|`|\bsource\b/);
    expect(body).toMatch(/exec \/usr\/bin\/env -i PATH=\/usr\/bin:\/bin LANG=C "\$NODE" "\$BUNDLE" "\$\{ARGS\[@\]\}" 2>\/dev\/null/);
    expect(body).toMatch(/\[ "\$#" -eq 1 \] \|\| fail 2/);
  });

  it("pins the exact bundle that is checked in", () => {
    const pinned = /^EXPECTED_SHA256=([0-9a-f]{64})$/m.exec(src)![1];
    expect(createHash("sha256").update(bundle).digest("hex")).toBe(pinned);
    expect(() => execFileSync("node", [join(svc, "scripts", "build-ci-bundle.mjs"), "--check"], { stdio: "pipe" })).not.toThrow(); // matches a fresh build of the source
  });

  it("the bundle imports only Node built-ins and cannot spawn processes or evaluate code", () => {
    const imports = [...bundle.matchAll(/^import .* from "([^"]+)";$/gm)].map((x) => x[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const i of imports) expect(i, i).toMatch(/^node:(fs|dns\/promises|net|crypto)$/);
    expect(bundle).not.toMatch(/child_process|\bspawn\b|\bexecSync\b|\beval\(|new Function|require\(/);
    expect(bundle).toMatch(/process\.argv\.includes\("--probe"\)/); // the only argument it reads
  });

  const setup = () => {
    const tmp = mkdtempSync(join(tmpdir(), "run-"));
    const lib = join(tmp, "lib");
    execFileSync("mkdir", ["-p", lib]);
    chmodSync(lib, 0o755);
    const b = join(lib, "pi-check.mjs");
    writeFileSync(b, "console.log('stand-in bundle')\n");
    chmodSync(b, 0o644);
    const node = join(lib, "node");
    writeFileSync(node, '#!/bin/sh\necho "ARGS:$*"\nenv | sort | tr "\\n" ","\necho\necho "SECRET-ON-STDERR" >&2\n');
    chmodSync(node, 0o755);
    const uid = execFileSync("stat", ["-c", "%u", b], { encoding: "utf8" }).trim();
    const sha = createHash("sha256").update(readFileSync(b)).digest("hex");
    const script = join(tmp, "run");
    const p = (s: string) => s.replaceAll("\\", "/");
    writeFileSync(script, asLocal(src).replace(/^BUNDLE=.*$/m, `BUNDLE=${p(b)}`).replace(/^NODE=.*$/m, `NODE=${p(node)}`).replace(/^ROOT_UID=.*$/m, `ROOT_UID=${uid}`).replace(/^EXPECTED_SHA256=.*$/m, `EXPECTED_SHA256=${sha}`));
    chmodSync(script, 0o755);
    return { b, lib, script, p };
  };
  // Only meaningful where permission bits behave (POSIX).
  const permsWork = () => { const s = setup(); return (statSync(s.b).mode & 0o777) === 0o644; };
  const posix = runnable && permsWork();

  it.runIf(posix)("accepts only `check` and `probe`, passes no other argument, and clears the environment", () => {
    const s = setup();
    const run = (...a: string[]) => spawnSync("bash", [s.script, ...a], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--require=evil", LD_PRELOAD: "/tmp/evil.so", HTTPS_PROXY: "http://evil" } });
    const c = run("check");
    expect(c.status).toBe(0);
    expect(c.stdout).toContain(`ARGS:${s.p(s.b)}\n`);
    expect(c.stdout).not.toMatch(/NODE_OPTIONS|LD_PRELOAD|HTTPS_PROXY|evil/);
    expect(c.stdout + c.stderr).not.toContain("SECRET-ON-STDERR");
    expect(run("probe").stdout).toContain(`ARGS:${s.p(s.b)} --probe`);
    for (const bad of [[], ["check", "probe"], ["check;id"], ["--probe"], ["PROBE"], [""], ["check", "--evil"], ["$(id)"], ["probe", ";", "id"]]) {
      const r = run(...bad);
      expect(r.status, JSON.stringify(bad)).toBe(2);
      expect(r.stdout).toBe("");
    }
  });

  it.runIf(posix)("refuses a tampered bundle and a group/world-writable bundle or directory", () => {
    const s = setup();
    const run = () => spawnSync("bash", [s.script, "check"], { encoding: "utf8" });
    expect(run().status).toBe(0);
    chmodSync(s.b, 0o664);
    expect(run().status).toBe(4);
    chmodSync(s.b, 0o644);
    chmodSync(s.lib, 0o775);
    expect(run().status).toBe(4);
    chmodSync(s.lib, 0o755);
    expect(run().status).toBe(0);
    writeFileSync(s.b, "console.log('swapped by an attacker')\n");
    chmodSync(s.b, 0o644);
    const r = run();
    expect(r.status).toBe(4);
    expect(r.stdout).toBe(""); // nothing ran
  });

  it.runIf(runnable)("refuses to run a bundle owned by someone other than root", () => {
    const s = setup();
    // The real script pins ROOT_UID=0; a non-root owner must fail the ownership test.
    const real = asLocal(src).replace(/^BUNDLE=.*$/m, `BUNDLE=${s.p(s.b)}`);
    const tmp = join(dirname(s.script), "real");
    writeFileSync(tmp, real);
    const r = spawnSync("bash", [tmp, "check"], { encoding: "utf8" });
    const amRoot = execFileSync("id", ["-u"], { encoding: "utf8" }).trim() === "0";
    if (!amRoot) expect(r.status).toBe(4);
  });
});

describe("installer is additive and cannot widen access", () => {
  const inst = code(read(join(dir, "install.sh")));
  it("defaults to a dry run", () => expect(inst).toMatch(/APPLY=0/));
  it("touches nothing else on the server", () => {
    expect(inst).not.toMatch(/sshd_config|\/etc\/ssh\b|ufw|iptables|docker|systemctl|nginx|supabase|certbot|usermod -a|gpasswd|adduser .*(sudo|docker|adm)|\/etc\/sudoers(?!\.d)|authorized_keys\b.*>>/);
    expect(inst).toMatch(/\/etc\/sudoers\.d\/isp-pi-check/);
    expect(inst).toMatch(/visudo -cf/);
  });
  it("accepts only a plain ed25519 public key (no private key, no options, one line)", () => {
    expect(inst).toMatch(/\^ssh-ed25519 /);
    expect(inst).toMatch(/exactly one line/);
  });
  it("makes the account's home and key file root-owned so it cannot edit its own access", () => {
    expect(inst).toMatch(/install -d -o root -g root -m 0755 \/var\/lib\/isp-ci \/var\/lib\/isp-ci\/\.ssh/);
    expect(inst).toMatch(/install -o root -g root -m 0644 "\$tmpkeys" \/var\/lib\/isp-ci\/\.ssh\/authorized_keys/);
    expect(inst).toMatch(/--shell \/bin\/sh/);
    expect(inst).toMatch(/refusing/); // an existing isp-ci in extra groups is rejected
  });
  it.runIf(runnable)("all shell scripts parse", () => {
    for (const f of ["install.sh", "uninstall.sh", "isp-pi-check-entry", "isp-pi-check-run"]) {
      const r = spawnSync("bash", ["-n", join(dir, f)], { encoding: "utf8" });
      expect(r.status, `${f}: ${r.stderr}`).toBe(0);
    }
  });
  it("installed files are copied from the repository, not generated from caller input", () => {
    for (const f of ["pi-check.mjs", "isp-pi-check-run", "isp-pi-check-entry", "sudoers.isp-pi-check", "authorized_keys.template"]) expect(inst).toContain(f);
  });
});

