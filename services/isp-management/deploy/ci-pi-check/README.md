# CI-only, read-only PI check: the server-side restriction

**Status: proposed. Nothing here has been installed.** `install.sh` is a dry run unless a human
passes `--apply`, and it is not run by any workflow.

This is an *additional, isolated* access path for the `isp-pi-check` workflow. It does not change the
SSH access administrators use today (no `sshd_config` edit, no change to any existing user,
`authorized_keys`, sudoers file, firewall, Docker, nginx, Supabase, PI or RADIUS).

## The four artifacts (all in this directory, all reviewed in the PR)

### 1. `authorized_keys` entry (`authorized_keys.template`, installed root-owned at `/var/lib/isp-ci/.ssh/authorized_keys`)
```
restrict,command="/usr/local/sbin/isp-pi-check-entry",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty,no-user-rc ssh-ed25519 <PUBLIC KEY> isp-pi-check-ci
```
`restrict` switches off every capability at once; the `no-*` options repeat the important ones so an
auditor can see them. `command=` is the forced command: sshd runs it instead of anything the client asks.

### 2. sudoers rule (`sudoers.isp-pi-check`, installed as `/etc/sudoers.d/isp-pi-check`, 0440, validated with `visudo -cf` first)
```
Cmnd_Alias ISP_PI_CHECK = /usr/local/sbin/isp-pi-check-run check, /usr/local/sbin/isp-pi-check-run probe
Defaults:isp-ci env_reset, !setenv, !env_editor
Defaults:isp-ci secure_path="/usr/bin:/bin"
Defaults:isp-ci !requiretty, !visiblepw
isp-ci ALL=(root) NOPASSWD: ISP_PI_CHECK
```
Sudo is needed only because the PI env file is `root:root 0600` and must stay that way; the account
itself can never read it. A sudoers entry that spells out its arguments matches exactly those arguments.

### 3. The fixed entry point
* `isp-pi-check-entry` (unprivileged, runs as `isp-ci`): accepts the literal words `check` or `probe` from
  `SSH_ORIGINAL_COMMAND`, nothing else (exit 2, no output), then `exec sudo -n isp-pi-check-run <word>`.
* `isp-pi-check-run` (root, the only thing sudo allows): requires exactly one argument of those two words;
  one run at a time; verifies the bundle and its directory are root-owned and not group/world-writable;
  verifies the **SHA-256 of `/usr/local/lib/isp-pi-check/pi-check.mjs` equals the hash pinned in the script**;
  then runs `env -i … node pi-check.mjs [--probe]` with stderr discarded.
* `pi-check.mjs`: the program built from `src/pi-check.ts` (11 KB, readable, not minified). It reads
  `/etc/visionex-isp/isp.env` itself and prints only `<label>: PASS|FAIL|SKIP`.

The bundle is **not** supplied by the workflow. It is installed by an administrator from the approved commit
of `main`, and the pin means any other bytes make the runner refuse. A test rebuilds the bundle from source
and fails if the checked-in bundle or the pinned hash is stale (`npm run ci-bundle` regenerates both).

### 4. Why an arbitrary command is impossible
| Attempt | Why it fails |
| --- | --- |
| Ask for a shell or any command (`ssh host 'id'`) | `command=` replaces it; the text only reaches `SSH_ORIGINAL_COMMAND`, where it is compared to two words. Anything else exits 2 |
| Injection via `;`, `&&`, `` ` ``, `$()`, newlines, globs, `${IFS}` | The text is matched by a `case` word-match and never evaluated, expanded or passed to a shell; the tested inputs include all of these |
| Smuggle arguments (`check --x`, `probe extra`) | Not equal to a literal word, so refused; `sudo` is then called with a hard-coded argument |
| Run another program as root | sudoers lists two exact command lines; no wildcard, no `ALL`, no `SETENV`, no shell |
| Change what runs as root | The runner and bundle are root-owned, directory not writable by others; the hash pin rejects any other bytes; `isp-ci` has no write access anywhere (home and key file are root-owned) |
| Environment / `LD_PRELOAD` / `NODE_OPTIONS` | `PermitUserEnvironment` is off and Ubuntu accepts only `LANG`/`LC_*`; sudo `env_reset` drops even those; `env -i` before node |
| TTY, port/agent/X11 forwarding, `~/.ssh/rc`, sftp/scp | `restrict` + `no-*`; a forced command also overrides subsystems |
| Docker, database, other files | The account is in no groups (the installer refuses an existing `isp-ci` that is), has no sudo beyond the two lines, and the program opens one fixed file and one network host |
| Workflow input / secret injection | The workflow sends only `check` or `probe` chosen by `if/else` on a boolean; static tests forbid any `${{ }}` inside a script |
| Read the PI credentials | Only the node process reads the file; it prints a closed vocabulary; the runner drops other lines and stderr |

### Residual risks (honest list)
* If the CI **private key leaks**, an attacker can trigger the check (it logs in to PI with the stored
  account and reports PASS/FAIL). They cannot run anything else or read the credentials. Mitigation: it is a
  dedicated key, trivially revoked by `uninstall.sh` or deleting one line; `from=` cannot pin GitHub-hosted runners.
* A vulnerability in OpenSSH, sudo, or Node itself would sit outside this design.
* The optional `PI_PROBE_SHAPES_FILE` is the one write the program can perform: a root-owned path under
  `/etc/visionex-isp/` or `/var/lib/visionex-isp/` chosen in the protected env file, never by the caller.
* Without the optional `ISP_PI_CHECK_HOST_KEY` secret the runner trusts the server key on first use.

## Procedure (a human, on the server, after approval)
```bash
# 0. on your own machine: a NEW key just for this; the private half never touches the server
ssh-keygen -t ed25519 -N '' -C isp-pi-check-ci -f ./isp-pi-check
gh secret set ISP_PI_CHECK_SSH_KEY < ./isp-pi-check        # then delete ./isp-pi-check
# optional but recommended: pin the server's host key
ssh-keyscan -t ed25519 <server> | gh secret set ISP_PI_CHECK_HOST_KEY

# 1. on the server, from a checkout of the approved commit of main
sudo ./deploy/ci-pi-check/install.sh --pubkey-file ./isp-pi-check.pub           # dry run: read it
sudo ./deploy/ci-pi-check/install.sh --pubkey-file ./isp-pi-check.pub --apply
```
Rollback: `sudo ./deploy/ci-pi-check/uninstall.sh --apply` removes the key, sudoers rule, scripts, bundle and the
account. Existing administrator access is never touched, so there is nothing to restore.

Secrets used by the workflow: `ISP_PI_CHECK_SSH_KEY` (new), `ISP_PI_CHECK_HOST_KEY` (new, optional) and
`SERVER_HOST` (existing). The PI credentials are **not** GitHub secrets; they stay in `/etc/visionex-isp/isp.env`.
