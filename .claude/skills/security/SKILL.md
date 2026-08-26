---
name: security
description: Security rules for Visionex changes that touch authentication, authorization, secrets, SQL permissions, webhooks, identity or user data. Load before writing such a change, and to review one — scoped to what changed, never the whole repository.
---

# Security

**Scope the review to what changed.** A full security audit for a small change
costs a lot and finds what the last full audit found. Review the path your diff
actually touches, and the boundary it crosses.

## Non-negotiable

1. Least privilege, always. Never widen a grant, a policy or a scope to make
   something work — find the exact role that needs it.
2. Secrets live in the environment, never in the repository, never in a log
   line, never in a test fixture. A realistic-looking fake token in a test will
   be rejected by push protection, and it should be.
3. Authentication answers who; authorization answers whether. Both, on every
   path that reads or writes somebody's data.
4. Identity is proved out of band — a code to an address the account owns — not
   asserted by an inbound identifier. A phone number, an email in a form field
   and a header are claims, not proof.
5. Webhook signatures are verified over the raw body, with a constant-time
   compare, before parsing. A missing secret fails closed.
6. Rate limits belong on anything a stranger can call in a loop, and the reply
   to a throttled caller must not itself be the flood.
7. Never log or return anything that identifies a person: no phone number, no
   address, no email, no one-time code, no message body. Lengths and outcomes.
8. An answer must not reveal what the sender is not entitled to know. "If that
   address has an account, a code is on its way" is said to every address, and
   the slow part happens after the reply so the timing says nothing either.

## SQL specifically

9. `REVOKE … FROM PUBLIC` also takes the privilege from `service_role`. Grant it
   back explicitly, or the feature fails in production.
10. `SECURITY DEFINER` bypasses RLS: check identity inside the body, pin
    `search_path`, qualify every name.
11. A table with no policy and RLS enabled is service-role-only. That is a
    decision — do not "fix" it with a policy.

## Reviewing

12. Trace the real execution path. Read the caller, not just the function.
13. Ask what an attacker controls, what they learn from each distinct response,
    and what happens when they repeat it.
14. Prefer a test that pins the boundary over a note that describes it.

Depth: `security-auditor` for threat modelling, the `security-reviewer` agent
for an independent read-only review of a risky diff.
