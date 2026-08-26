---
name: supabase
description: Working rules for Visionex migrations, Edge Functions, RPCs and row-level security, including how to actually execute SQL on a machine with no Docker. Load before writing or changing anything under supabase/.
---

# Supabase

## Migrations

1. Timestamp after the last file in `supabase/migrations/`. Check the directory
   listing, not your memory — names, versions and function signatures have
   collided here before.
2. Additive and re-runnable: `IF NOT EXISTS`, `CREATE OR REPLACE`, guarded
   `ALTER`. A migration that cannot run twice will eventually run twice.
3. Never edit a migration that has been applied in production. Write another.
4. Execute it before shipping it. There is no Docker, psql or local Postgres on
   this machine, and no CI job runs the SQL — `db push` in the deploy is
   otherwise the first thing that ever parses the file. Use PGlite in the
   scratchpad, with stub `anon`, `authenticated` and `service_role` roles and a
   stub `auth.users`, and drive the functions with real calls.

## Permissions

5. **Never fix a permission failure by granting broader access than required.**
   Find the role that must call it and grant exactly that.
6. `REVOKE ALL ON FUNCTION … FROM PUBLIC` also revokes `service_role`. Every
   `SECURITY DEFINER` function an Edge Function calls needs
   `GRANT EXECUTE … TO service_role` written beside the revoke, or every RPC
   fails in production with a permission error no test will catch.
7. `SECURITY DEFINER` bypasses RLS. Check the caller's identity inside the
   function body, keep `SET search_path`, and qualify every table name.
8. RLS on, no policy, service-role-only is the correct shape for a table whose
   contents are an implementation detail. Say so in a comment so nobody adds a
   policy "to make it work".
9. New policies wrap `auth.uid()` and role helpers in `(select …)` so they are
   evaluated once, not per row.

## Edge Functions

10. Extend an existing function before adding one. The project is near the
    hundred-function ceiling, where a new function fails with a billing error
    that reads like a bundling error.
11. `verify_jwt = false` has to be in `supabase/config.toml` *and* in
    `scripts/deploy-changed-supabase-functions.sh`. Only the script reaches
    production.
12. Type-check with `deno check --no-lock --node-modules-dir=none`. Without the
    flag it fails on npm resolution rather than on your types.

## Depth

`supabase-postgres-best-practices` for schema, indexing and query shape;
`database-supabase-expert` for design questions; `security` before granting
anything.
