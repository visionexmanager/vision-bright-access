-- ============================================================
-- Seed: additional Library categories for the Phase 3 home page
-- Purpose:   The prompt names several category rails (Programming, AI,
--            Business, Children's Books, Magazines, Research) that don't
--            exist among the 6 categories seeded in Phase 2
--            (20260720000005_library_seed.sql — Fiction, Non-Fiction,
--            Science Fiction, Self Development, History, Mystery &
--            Thriller). This migration adds ONLY the category rows
--            (metadata, book_count = 0) — no book content. Opening one of
--            these categories today correctly shows the "add the first
--            book" empty state, which is the explicitly-required fallback
--            behavior for a category with no books yet, not a missing
--            category. Fixed literal UUIDs, ON CONFLICT DO NOTHING, safe
--            to re-run.
-- ============================================================

INSERT INTO public.library_categories (id, parent_id, name, slug, description, icon, display_order)
VALUES
  ('ca100000-0000-4000-8000-000000000011', NULL, 'Technology', 'technology', 'Computing, software, and the tools that build them', 'Cpu', 7),
  ('ca100000-0000-4000-8000-000000000009', 'ca100000-0000-4000-8000-000000000011', 'Artificial Intelligence', 'ai', 'Machine learning, neural networks, and AI theory', 'Bot', 8),
  ('ca100000-0000-4000-8000-000000000010', 'ca100000-0000-4000-8000-000000000011', 'Programming', 'programming', 'Software engineering and programming languages', 'Code2', 9),
  ('ca100000-0000-4000-8000-000000000012', NULL, 'Business', 'business', 'Management, entrepreneurship, and business strategy', 'Briefcase', 10),
  ('ca100000-0000-4000-8000-000000000007', NULL, 'Children''s Books', 'children-books', 'Stories and learning books for younger readers', 'Baby', 11),
  ('ca100000-0000-4000-8000-000000000013', NULL, 'Magazines', 'magazines', 'Periodicals and serialized publications', 'Newspaper', 12),
  ('ca100000-0000-4000-8000-000000000014', NULL, 'Research', 'research', 'Academic papers and research publications', 'FlaskConical', 13),
  ('ca100000-0000-4000-8000-000000000008', NULL, 'Educational', 'educational', 'Textbooks and structured learning material', 'GraduationCap', 14)
ON CONFLICT (id) DO NOTHING;
