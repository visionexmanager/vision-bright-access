# Visionex Library — Database Schema (Phase 2)

This document explains the real Supabase/Postgres backend for the Library section
(books/audiobooks catalog). It covers what Phase 2 built: tables, relationships, storage
buckets, RLS policies, triggers, and edge functions. Phase 1 built the frontend against mock
data; Phase 3 (not started) is the piece that rewires `src/services/library/*.ts` to call this
real backend instead.

Migration files, in order:

| File | Contents |
|---|---|
| `20260720000000_library_core_catalog.sql` | categories, publishers, authors, books, book files, audiobooks, chapters, tags, quotes, full-text search |
| `20260720000001_library_core_engagement.sql` | reviews, shelf, favorites, reading progress, reading lists, bookmarks, notes, highlights, downloads |
| `20260720000002_library_core_commerce_gamification.sql` | purchases, borrowing, VX rewards, challenges, achievements |
| `20260720000003_library_core_discovery_analytics.sql` | recommendations cache, search history, recently viewed, daily/weekly/monthly/yearly stats |
| `20260720000004_library_storage.sql` | 6 storage buckets and their access policies |
| `20260720000005_library_seed.sql` | sample categories/authors/books matching Phase 1's mock UI |

## Tables

### Catalog

- **`library_categories`** — hierarchical via a self-referencing `parent_id` (nullable; a
  category can be a top-level or a child of another). `book_count` is a denormalized counter
  kept in sync by a trigger, not computed on read.
- **`library_publishers`** — flat list, no hierarchy.
- **`library_authors`** — author profiles. `user_id` is nullable and only set once a real
  account has claimed/been linked to this author profile — that's what makes "author edits
  their own books" work (see RLS below) without inventing a new role. `books_count`,
  `follower_count`, and `rating_avg`/`rating_count` are denormalized and trigger-maintained.
- **`library_books`** — the central table. Key columns: `author_id`/`publisher_id`/`category_id`
  (FKs), `book_type` (ebook/audiobook/physical/hybrid), `is_free` + `price_vx`/`price_usd` (a
  paid book must have at least one price — enforced by a `CHECK` constraint), `publish_status`
  (draft/published/archived — draft books are invisible to everyone except the owner/admin),
  `lending_copies_total` (null = not lendable or unlimited), and a generated `search_vector`
  column for full-text search (see below). `views_count`/`downloads_count`/`likes_count`/
  `reviews_count`/`rating_avg`/`rating_count` are denormalized, trigger-maintained counters.
- **`library_book_files`** — one row per file format (pdf/epub/txt/docx/brf/audio) belonging to
  a book, pointing at a storage path.
- **`library_audiobooks`** — audio-edition metadata (narrator, duration, sample). Points at a
  `library_book_files` row for the actual audio asset via `audio_file_id`.
- **`library_chapters`** — a book split into chapters. `is_free_preview` lets any visitor read
  that one chapter even on a paid book, independent of purchase status.
- **`library_tags`** / **`library_book_tags`** — free-form tagging, many-to-many junction.
- **`library_quotes`** — standalone quotable passages, `is_approved` gates public visibility
  (used by `library-generate-quotes` — non-admin submissions start unapproved).

### Engagement (all strictly per-user private data unless noted)

- **`library_reviews`** — rating (1–5, required) + optional comment. This is the single table
  for what the original request called "Reviews" and "Ratings" — a rating with no comment is
  just a row where `comment IS NULL`.
- **`library_shelf_items`** ("My Library") and **`library_favorites`** — two separate tables,
  matching Phase 1's frontend, which already treats "added to my library" and "favorited" as
  distinct actions with distinct pages.
- **`library_reading_progress`** — one row per user/book (composite PK), holding both what the
  original request called "Reading History" (last position, last read timestamp) and "Reading
  Progress" (percent complete) — again, one table, since they're the same underlying fact.
- **`library_reading_lists`** / **`library_reading_list_items`** — user-created lists, a real
  junction table with `order_index` (not an array column) so item order is stable and each
  membership can carry metadata later without a schema change.
- **`library_bookmarks`**, **`library_notes`**, **`library_highlights`** — always private,
  never visible to anyone but their owner (or admin, for moderation).
- **`library_downloads`** — a log of what a user has downloaded and in what format; inserting a
  row requires the user to actually have access to that book's content.

### Commerce & gamification

- **`library_purchases`** — mirrors the existing VXBazaar order shape (dual VX/cash pricing,
  Stripe fields). A buyer can create their own row in `pending` status; only an admin (or a
  service-role edge function, which bypasses RLS) can transition it to `paid`/`completed` — a
  buyer cannot mark their own purchase as paid.
- **`library_borrowed_books`** — time-limited borrowing with a `due_at`. A trigger prevents
  borrowing past `library_books.lending_copies_total` if that column is set.
- **`library_xp_events`** — an audit log of every VX award. **The actual VX balance is
  `public.user_points`, the same table the rest of the app already reads via
  `useVXWallet()`** — Library does not have a separate wallet.
- **`library_challenges`** / **`library_challenge_progress`** — reading challenges with a goal
  type (books/pages/minutes) and a VX reward.
- **`library_achievements`** / **`library_user_achievements`** — badge definitions and who's
  earned them; earned badges are publicly visible (like a profile flex), the same visibility
  model as reviews.

### Discovery & analytics

- **`library_book_recommendations`** — a cache table, written only by the
  `library-recommend-books` edge function (service-role client) and readable only by the user
  it was generated for.
- **`library_search_history`** / **`library_recently_viewed`** — per-user logs.
- **`library_book_daily_stats`** — the single source of truth for analytics, at daily grain. A
  helper function `bump_library_daily_stat()` plus a set of triggers on favorites/reviews/
  downloads/purchases/reading-progress keep it updated automatically as those events happen —
  nothing needs to call an edge function just to log a view or a download.
- **`library_book_stats_weekly`** / **`library_book_stats_yearly`** — plain `VIEW`s that
  aggregate the daily table on the fly (`security_invoker = true`, so they enforce the querying
  user's own RLS rather than the view owner's elevated privileges).
- **`library_book_stats_monthly`** — a `MATERIALIZED VIEW` (this rollup is the one an admin
  dashboard is expected to hit hardest). Materialized views do **not** enforce the base table's
  RLS for anyone with `SELECT` on them, so access is locked down explicitly: only
  `service_role` can read it, and only the `library-book-analytics` edge function is meant to.
  Refreshing it requires either the `pg_cron` Postgres extension (a project-level toggle in the
  Supabase dashboard, not something a migration can turn on) calling
  `select public.refresh_library_monthly_stats()` on a schedule, or a scheduled edge function
  doing the same via a service-role client.

## Relationships

Every FK follows one rule: **user identity always points at `auth.users(id)`, never at
`profiles`** — same convention the existing Academy schema uses. `ON DELETE` behavior:

- **CASCADE** — personal data tied to a user or a book (favorites, progress, notes, chapters,
  reviews, etc.) — deleting the user or book should take their personal data / child rows with
  them.
- **SET NULL** — `library_books.publisher_id`/`category_id` (losing a publisher/category
  shouldn't delete the book, just leave it uncategorized), `library_categories.parent_id`
  (deleting a parent category promotes its children to top-level, doesn't delete them),
  `library_authors.user_id` (an author profile survives its linked account being deleted).
- **RESTRICT** — `library_books.author_id` (can't delete an author who still has books —
  reassign the books first), `library_purchases.buyer_id`/`book_id` (a financial record should
  never silently disappear because of an unrelated deletion).

## Storage buckets

| Bucket | Public? | Notes |
|---|---|---|
| `library-book-covers` | Yes | Marketing/browsing images |
| `library-author-images` | Yes | Author photos |
| `library-category-images` | Yes | Admin-managed only |
| `library-book-files` | **No** | Gated by `can_access_library_book_content()`; path convention `{book_id}/{filename}` |
| `library-audiobooks` | **No** | Same gating as book-files |
| `library-temp-uploads` | **No** | Private per-user staging for `library-import-book`; owner-only |

The two gated buckets are the direct implementation of the prompt's explicit requirement
("visitor reads free books only / member reads purchased books only") — a visitor or non-owner
who requests a file for a paid book they haven't purchased gets denied at the storage layer,
not just hidden in the UI.

## Row Level Security

Every table has RLS enabled. The four access tiers from the request map to:

- **Visitor (anonymous)** — can `SELECT` published + free content only (`library_books.
  publish_status = 'published'`, gated further by `can_access_library_book_content()` for
  actual file/chapter content).
- **Member (authenticated)** — everything a visitor can see, plus anything they've purchased or
  actively borrowed, plus full read/write on their own personal-data rows.
- **Author** (`library_authors.user_id = auth.uid()`) — full control of their own books,
  chapters, and files via `is_library_book_owner()`. This is table-ownership-based, not a new
  role — the existing `app_role` enum stays `admin`/`user` only.
- **Admin** (`public.has_role(auth.uid(), 'admin')`, the existing helper) — full control
  everywhere.

The key access-control function is `public.can_access_library_book_content(_book_id)`, used by
both table RLS (chapters, book files) and storage RLS. It's defined in the catalog migration
without a purchases check (that table doesn't exist yet at that point), then upgraded via
`CREATE OR REPLACE FUNCTION` in the commerce migration once purchases/borrows exist. Because RLS
policies call the function by name at query time, every policy that referenced the early version
picks up the fuller logic automatically — no policy needed to be touched twice.

## Triggers

- **`touch_updated_at()`** — the existing shared trigger, reused (not redefined) for every new
  table with an `updated_at` column.
- **`recompute_library_book_rating()`** — fires on every review write, recomputes the book's
  `rating_avg`/`rating_count`/`reviews_count`, and rolls the change up into the book's author's
  own `rating_avg`/`rating_count`.
- **`maintain_library_book_counts()`** — fires on book insert/update/delete, keeps
  `library_authors.books_count` and `library_categories.book_count` correct even when a book's
  author or category is reassigned later.
- **`check_library_lending_availability()`** — fires before a borrow is inserted, blocks it if
  the book has no available copies left.
- The six `trg_bump_library_stat_*` triggers — fire on favorites/reviews/downloads/purchases
  (completions only)/reading-progress-started/reading-progress-completed, each calling
  `bump_library_daily_stat()` to keep the analytics fact table current in real time.

## Edge functions

New, under `supabase/functions/library-*`:

| Function | Purpose |
|---|---|
| `library-track-reading` | Upsert a user's reading progress for one book |
| `library-sync-progress` | Reconcile a Phase 1 localStorage snapshot (shelf/favorites/downloads/progress) into real rows on login — additive only, never regresses progress that's further along on the server |
| `library-reward-vx` | Maps a friendly event name to the `award_library_xp()` reason string |
| `library-book-analytics` | Reads the daily/weekly/monthly/yearly stats for one book, author-or-admin only |
| `library-recommend-books` | Same-category/same-author signal from the caller's own shelf/favorites, plus a "readers with similar taste" collaborative signal; writes results into the recommendations cache |
| `library-generate-quotes` | Extracts candidate quotes from a chapter's text via the shared AI completion helper; non-admin submissions are unapproved until reviewed |
| `library-import-book` | Consolidates "Import EPUB", "Import PDF", and "Metadata Extraction" into one pipeline: parses a staged upload, extracts metadata/chapters/cover, uploads processed assets, inserts the book |

**Reused, not duplicated:** OCR ("OCR Processing" in the request) uses the existing `ocr-scan`
function as-is — it's already a generic image-to-text call with rate limiting, nothing
Library-specific was needed.

All 7 new functions are wired into `.github/workflows/deploy.yml`'s existing hand-maintained
deploy list (this repo does not auto-discover functions from the directory — a function only
reaches production once its `supabase functions deploy <name>` line is added there).

`award_library_xp()` deserves a specific callout: it's a Postgres RPC `GRANT`ed directly to the
`authenticated` role, meaning any signed-in client can call it directly (bypassing
`library-reward-vx` entirely) with `supabase.rpc('award_library_xp', {...})`. Because of that,
the per-reason amount cap lives **inside the RPC itself** (a `CASE` whitelist, same pattern as
the existing `award_points()`), not only in the edge function — a cap that only exists in the
edge function isn't a real cap.

## Known limitations / what to verify before production

- **Not run against a live database.** This sandbox has no Supabase CLI/Docker access, so these
  migrations have been reviewed carefully (forward-reference checks, RLS-coverage checks,
  function-call resolution — all done via static analysis of the SQL text) but never actually
  executed. Run `supabase db push` against a staging project first.
- **`library-import-book`'s EPUB/PDF parsing is unverified.** It's a real implementation
  (JSZip + hand-rolled OPF/spine parsing for EPUB, `pdf-parse` for PDF), not a stub, but it's
  the one piece of Phase 2 that genuinely needs a smoke test against a real file on first
  deploy — Deno's `npm:` compatibility layer for these packages hasn't been exercised here.
- **`pg_cron` is not enabled by this migration** (it's a Supabase-dashboard toggle). Until it's
  turned on and scheduled, `library_book_stats_monthly` needs a manual or externally-scheduled
  call to `refresh_library_monthly_stats()` to stay current.
- **TypeScript types were hand-added** to `src/integrations/supabase/types.ts` (no
  `supabase gen types` script exists in this repo — the file is already hand-maintained, and
  notably the existing Academy LMS tables aren't in it either). Regenerating via the real
  Supabase CLI once you have project access would be strictly more reliable than trusting
  hand-typed definitions that were never run through `tsc`.

## How to extend this later

- **New book format**: add a value to `library_book_files.file_type`'s `CHECK` constraint in a
  new migration (`ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...`), no new table needed.
- **New personal-data feature** (e.g. "Book Clubs"): follow the exact shape of
  `library_reading_lists`/`library_reading_list_items` — a parent table owned by `user_id`, RLS
  `FOR ALL USING (auth.uid() = user_id)`, plus a junction table if it needs members.
  `is_library_reading_list_owner()`/`is_library_reading_list_visible()` are the templates for
  the "owner OR public" visibility helper pattern.
  Author-owned content (new book-related tables): reuse `is_library_book_owner(_book_id)`
  directly rather than writing a new ownership check.
- **New analytics dimension**: add a column to `library_book_daily_stats` and a matching
  `trg_bump_library_stat_*` trigger — the weekly/monthly/yearly views pick up new columns
  automatically the next time they're `CREATE OR REPLACE`d (regular views) or refreshed
  (materialized view) with the new `SUM(...)` added to their `SELECT` list.
- **New VX-earning action**: add a `WHEN _reason LIKE '...' THEN _max_amount := N;` branch to
  `award_library_xp()`'s whitelist `CASE`, and a matching entry in `library-reward-vx`'s
  `EVENT_REASON_PREFIX` map.
