# Incident response

## First five minutes (any suspected compromise or wrong change)
1. **Stop changes:** Web → System → *Disable ALL changes*. Reads continue. (If the console is unreachable:
   `docker compose -p visionex-isp stop api worker`.)
2. **Preserve evidence:** do not restart or prune; export `audit_logs` and `system_events`, copy container logs.
3. **Check integrity:** Audit → Verify integrity. A broken chain names the first altered entry.

## Scenarios
| Signal | Action |
| --- | --- |
| Admin credentials suspected stolen | Disable the user (revokes sessions), change password, review `LOGIN` / `SERVICE_*` audit rows for that actor |
| WhatsApp number lost or stolen | Web → WhatsApp admins → Disable the number; the unlock factor (authenticator) must also be rotated: create a new entry |
| `WA_SIGNATURE_INVALID` alert | Someone is posting to the webhook without the secret. Confirm rate limits held; rotate `WA_GATEWAY_HMAC_SECRET` if the secret may have leaked |
| `ENUMERATION_SUSPECTED` | Identify the actor in the audit log; disable them if not a real shift |
| `ACTION_INTERRUPTED` (critical) | An action stopped mid-execution. **Look the customer up in PI by hand** — the state is unknown. Re-run only after confirming |
| `VERIFICATION_FAILED` | PI accepted the call but does not show the change. Check PI; do not retry blindly |
| PI unreachable | Reads/writes fail with a fixed "temporarily unavailable"; check the tunnel, then PI |
| Database down | `/health` goes `unhealthy`; check the `db` container and disk; restore if corrupt (`BACKUP-RESTORE.md`) |
| Suspected leak of `ISP_ENCRYPTION_KEY` | Rotate it, force every admin and WhatsApp admin to re-enrol MFA |

## Recovery
Re-enable writes in this order: investigate → fix → kill-switch off → test on the test account → re-enable env
flags one at a time. Record the incident (timeline, root cause, change) in the repository's ops notes.
