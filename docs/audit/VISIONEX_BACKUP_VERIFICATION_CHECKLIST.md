# Backup verification checklist

A box is ticked only with evidence (workflow run URL, timestamp, file hash) written next to it. Nothing below has been ticked yet.

## C1 — Existence and recency
- [ ] Latest encrypted backup exists on the server directory; timestamp < 26 h old. Evidence: ______
- [ ] Latest copy exists on the owner's machine; timestamp < 26 h old. Evidence: ______
- [ ] Offsite/Option 2 copy (if chosen) exists. Evidence: ______
- [ ] Supabase Dashboard → Database → Backups screenshot/notes recorded (what the plan provides). Evidence: ______
- [ ] Hetzner Console backups/snapshots status recorded. Evidence: ______

## C2 — Integrity
- [ ] SHA-256 on the far side equals the manifest. 
- [ ] `age -d` succeeds with the offline private key (owner).
- [ ] Archive lists the expected parts: database dump, storage tar, manifest.
- [ ] Manifest row counts within ±5% of the previous backup (or explained).

## C3 — Confidentiality
- [ ] File is ciphertext (no readable SQL). 
- [ ] Private key is not on GitHub, the server, or the runner.
- [ ] Backup directory not web-served; SSH user cannot read outside it.
- [ ] No backup was ever uploaded as a public workflow artifact.
- [ ] Workflow logs contain only sizes, counts, hashes.

## C4 — Independence
- [ ] A compromise of the server alone cannot delete every copy (owner/offsite copy survives).
- [ ] A compromise of GitHub alone cannot decrypt a backup.
- [ ] Two people can recover the decryption key.

## C5 — Restore drill (new target only)
- [ ] CI drill on synthetic data passed. Run URL: ______
- [ ] Real-data drill into a scratch database passed. Date/tester: ______
- [ ] Table counts match manifest; extensions present; RLS enabled on every `public` table (query `pg_class.relrowsecurity`).
- [ ] Storage objects restored and openable.
- [ ] Time to restore recorded: ______ (this is the measured RTO).

## C6 — Operations
- [ ] Failed backup produces a red run and an owner email (test by breaking the SSH key in a branch run).
- [ ] Retention pruning verified (14 daily, 8 weekly).
- [ ] Quarterly drill scheduled; next date: ______
- [ ] Secrets inventory current (names, re-issue location).
