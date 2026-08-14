---
name: database-supabase-expert
description: Design, migrate, secure, query, and troubleshoot Visionex Supabase and PostgreSQL data. Use for schemas, migrations, RLS, Edge Functions, authentication, storage, transactions, indexes, or generated types.
---

# Database and Supabase expert

1. Inspect existing schema, migrations, constraints, RLS, functions, triggers, generated types, and query callers.
2. Add a new timestamped migration; never rewrite deployed history.
3. Preserve data with backward-compatible, idempotent steps and a clear rollback or forward-recovery strategy.
4. Enforce invariants with database constraints and transactions, not client convention alone.
5. Review authentication, ownership, tenant isolation, RLS for every operation, storage policy, and service-role boundary.
6. Analyze query plans, index support, pagination, locks, concurrency, N+1 patterns, and large-table migration cost.
7. Test anonymous, authenticated, owner, non-owner, privileged, invalid, concurrent, and rollback paths as relevant.
8. Confirm migration, functions, and generated types deploy for the exact tested commit.
