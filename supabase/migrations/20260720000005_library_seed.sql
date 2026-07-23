-- ============================================================
-- Seed: Library catalog sample data (Phase 2 backend)
--
-- Mirrors the exact books/authors/categories/quotes already shown in the
-- Phase 1 frontend mock (src/services/library/{catalog,authors,quotes}.ts)
-- so Phase 3's rewire from mock data to real Supabase queries is a
-- like-for-like swap with no visible content change — same names, same
-- slugs/category filters the UI already links to.
--
-- Fixed literal UUIDs (not gen_random_uuid()) so rows can reference each
-- other within this file. All INSERTs are ON CONFLICT (id) DO NOTHING, so
-- re-running this migration is a no-op.
--
-- NOT seeded: reviews, favorites, purchases, reading progress, or anything
-- else with a real auth.users FK — same reasoning as
-- 20260706000002_academy_lms_seed.sql (no fake user ids can satisfy a real
-- FK to auth.users). Every seeded book is is_free = true so Phase 3 can
-- exercise the full read/download/review flow without needing a purchase
-- first.
-- ============================================================

-- ── Categories ───────────────────────────────────────────────────────────
INSERT INTO public.library_categories (id, parent_id, name, slug, description, icon, display_order)
VALUES
  ('ca100000-0000-4000-8000-000000000001', NULL, 'Fiction', 'fiction', 'Novels and short stories', 'BookOpen', 1),
  ('ca100000-0000-4000-8000-000000000002', NULL, 'Non-Fiction', 'non-fiction', 'True stories and real-world knowledge', 'Library', 2),
  ('ca100000-0000-4000-8000-000000000003', 'ca100000-0000-4000-8000-000000000001', 'Science Fiction', 'sci-fi', 'Futures, space, and speculative worlds', 'Rocket', 3),
  ('ca100000-0000-4000-8000-000000000004', NULL, 'Self Development', 'self-development', 'Growth, habits, and productivity', 'Sparkles', 4),
  ('ca100000-0000-4000-8000-000000000005', NULL, 'History', 'history', 'The past, retold', 'Landmark', 5),
  ('ca100000-0000-4000-8000-000000000006', 'ca100000-0000-4000-8000-000000000001', 'Mystery & Thriller', 'mystery-thriller', 'Suspense and unsolved questions', 'Search', 6)
ON CONFLICT (id) DO NOTHING;

-- ── Publishers ───────────────────────────────────────────────────────────
INSERT INTO public.library_publishers (id, name, slug, description)
VALUES
  ('db100000-0000-4000-8000-000000000001', 'Horizon Press', 'horizon-press', 'Independent literary fiction publisher'),
  ('db100000-0000-4000-8000-000000000002', 'Nightingale Books', 'nightingale-books', 'Speculative fiction and science fiction'),
  ('db100000-0000-4000-8000-000000000003', 'Ember & Co', 'ember-and-co', 'Non-fiction, history, and personal development')
ON CONFLICT (id) DO NOTHING;

-- ── Authors ──────────────────────────────────────────────────────────────
INSERT INTO public.library_authors (id, user_id, name, slug, bio, nationality, birth_year)
VALUES
  ('ea100000-0000-4000-8000-000000000001', NULL, 'Lena Aldric', 'lena-aldric', 'Lena Aldric writes literary fiction about memory, family, and the coastline she grew up on.', 'Irish', 1981),
  ('ea100000-0000-4000-8000-000000000002', NULL, 'Marcus Feyn', 'marcus-feyn', 'Marcus Feyn is a science fiction author known for hard-science generation-ship sagas.', 'German', 1975),
  ('ea100000-0000-4000-8000-000000000003', NULL, 'Priya Nandan', 'priya-nandan', 'Priya Nandan writes on focus, habits, and sustainable productivity.', 'Indian', 1988),
  ('ea100000-0000-4000-8000-000000000004', NULL, 'Dorian Kesh', 'dorian-kesh', 'Dorian Kesh is a historian specializing in trade-route economics.', 'British', 1970)
ON CONFLICT (id) DO NOTHING;

-- ── Books ────────────────────────────────────────────────────────────────
INSERT INTO public.library_books
  (id, slug, title, subtitle, description, author_id, publisher_id, category_id, language,
   page_count, published_date, book_type, is_free, cover_image_url, publish_status,
   rating_avg, rating_count)
VALUES
  ('bc100000-0000-4000-8000-000000000001', 'the-silent-horizon', 'The Silent Horizon', NULL,
   'A quiet coastal town, a secret decades old, and the woman who returns to unearth it.',
   'ea100000-0000-4000-8000-000000000001', 'db100000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001',
   'en', 312, '2021-03-14', 'hybrid', true, NULL, 'published', 4.4, 128),

  ('bc100000-0000-4000-8000-000000000002', 'orbit-of-ash', 'Orbit of Ash', 'Book One of the Driftfall Saga',
   'The last generation ship in the galaxy is running out of orbit — and out of time.',
   'ea100000-0000-4000-8000-000000000002', 'db100000-0000-4000-8000-000000000002', 'ca100000-0000-4000-8000-000000000003',
   'en', 428, '2019-06-02', 'hybrid', true, NULL, 'published', 4.7, 342),

  ('bc100000-0000-4000-8000-000000000003', 'atomic-focus', 'Atomic Focus', NULL,
   'A practical framework for deep work in a distracted world.',
   'ea100000-0000-4000-8000-000000000003', 'db100000-0000-4000-8000-000000000003', 'ca100000-0000-4000-8000-000000000004',
   'en', 240, '2022-01-10', 'hybrid', true, NULL, 'published', 4.5, 561),

  ('bc100000-0000-4000-8000-000000000004', 'the-long-winter-road', 'The Long Winter Road', NULL,
   'Three siblings, one inheritance, and a house that remembers everything.',
   'ea100000-0000-4000-8000-000000000001', 'db100000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001',
   'en', 356, '2023-09-05', 'ebook', true, NULL, 'published', 4.2, 89),

  ('bc100000-0000-4000-8000-000000000005', 'signal-from-kestrel-deep', 'Signal From Kestrel Deep', NULL,
   'A first-contact story told entirely through mission logs.',
   'ea100000-0000-4000-8000-000000000002', 'db100000-0000-4000-8000-000000000002', 'ca100000-0000-4000-8000-000000000003',
   'en', NULL, '2020-11-20', 'audiobook', true, NULL, 'published', 4.1, 76),

  ('bc100000-0000-4000-8000-000000000006', 'habits-of-the-unhurried', 'Habits of the Unhurried', NULL,
   'Slowing down as a discipline, not a luxury.',
   'ea100000-0000-4000-8000-000000000003', 'db100000-0000-4000-8000-000000000003', 'ca100000-0000-4000-8000-000000000004',
   'en', 198, '2024-02-18', 'hybrid', true, NULL, 'published', 4.6, 213),

  ('bc100000-0000-4000-8000-000000000007', 'empire-of-salt', 'Empire of Salt', NULL,
   'How a single trade route reshaped three continents.',
   'ea100000-0000-4000-8000-000000000004', 'db100000-0000-4000-8000-000000000003', 'ca100000-0000-4000-8000-000000000005',
   'en', 512, '2018-05-30', 'hybrid', true, NULL, 'published', 4.3, 154),

  ('bc100000-0000-4000-8000-000000000008', 'small-mercies', 'Small Mercies', NULL,
   'A short story collection about the moments that quietly save us.',
   'ea100000-0000-4000-8000-000000000001', 'db100000-0000-4000-8000-000000000001', 'ca100000-0000-4000-8000-000000000001',
   'en', 176, '2020-08-11', 'hybrid', true, NULL, 'published', 4.0, 47)
ON CONFLICT (id) DO NOTHING;

-- ── Sample chapters (The Silent Horizon only — enough to exercise the
--    schema; the rest of the catalog's chapter content is authored later
--    via the real editor / library-import-book, not hand-seeded) ─────────
INSERT INTO public.library_chapters (id, book_id, chapter_number, title, content_text, is_free_preview, order_index)
VALUES
  ('cd100000-0000-4000-8000-000000000001', 'bc100000-0000-4000-8000-000000000001', 1, 'The Return',
   'The ferry cut its engine a hundred meters out, the way it always had, and let the current carry it the rest of the way in.', true, 1),
  ('cd100000-0000-4000-8000-000000000002', 'bc100000-0000-4000-8000-000000000001', 2, 'What the Tide Kept',
   'Some towns do not keep secrets so much as they keep waiting for someone to ask.', false, 2),
  ('cd100000-0000-4000-8000-000000000003', 'bc100000-0000-4000-8000-000000000001', 3, 'The House on Gull Street',
   'Nothing about the house had changed, which was itself the strangest thing about it.', false, 3)
ON CONFLICT (id) DO NOTHING;

-- ── Tags ─────────────────────────────────────────────────────────────────
INSERT INTO public.library_tags (id, name, slug)
VALUES
  ('fa100000-0000-4000-8000-000000000001', 'Bestseller', 'bestseller'),
  ('fa100000-0000-4000-8000-000000000002', 'New Release', 'new-release'),
  ('fa100000-0000-4000-8000-000000000003', 'Award Winner', 'award-winner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.library_book_tags (book_id, tag_id)
VALUES
  ('bc100000-0000-4000-8000-000000000002', 'fa100000-0000-4000-8000-000000000001'), -- Orbit of Ash: Bestseller
  ('bc100000-0000-4000-8000-000000000003', 'fa100000-0000-4000-8000-000000000001'), -- Atomic Focus: Bestseller
  ('bc100000-0000-4000-8000-000000000006', 'fa100000-0000-4000-8000-000000000002')  -- Habits of the Unhurried: New Release
ON CONFLICT DO NOTHING;

-- ── Quotes ───────────────────────────────────────────────────────────────
INSERT INTO public.library_quotes (id, book_id, text, likes_count, is_approved)
VALUES
  ('ab100000-0000-4000-8000-000000000001', 'bc100000-0000-4000-8000-000000000001',
   'Some towns don''t keep secrets so much as they keep waiting for someone to ask.', 214, true),
  ('ab100000-0000-4000-8000-000000000002', 'bc100000-0000-4000-8000-000000000002',
   'We did not leave Earth to escape it. We left to remember it correctly.', 389, true),
  ('ab100000-0000-4000-8000-000000000003', 'bc100000-0000-4000-8000-000000000003',
   'Attention is the only currency you can''t borrow against.', 512, true),
  ('ab100000-0000-4000-8000-000000000004', 'bc100000-0000-4000-8000-000000000006',
   'Slowness is not the absence of ambition. It is ambition with better judgment.', 176, true)
ON CONFLICT (id) DO NOTHING;

-- ── Sample reading challenge + achievements (system-defined content, no
--    user FK involved, safe to seed) ──────────────────────────────────────
INSERT INTO public.library_challenges (id, title, description, goal_type, goal_target, reward_vx, is_active)
VALUES
  ('9a100000-0000-4000-8000-000000000001', 'Summer Reading Sprint', 'Finish 5 books before the season ends.', 'books_count', 5, 250, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.library_achievements (id, code, name, description, icon, reward_vx)
VALUES
  ('9a100000-0000-4000-8000-000000000002', 'first_book_finished', 'First Chapter Closed', 'Finish your first book in the Library.', 'BookCheck', 50),
  ('9a100000-0000-4000-8000-000000000003', 'reviewer', 'Voice of the Library', 'Write your first book review.', 'MessageSquareText', 25)
ON CONFLICT (id) DO NOTHING;
