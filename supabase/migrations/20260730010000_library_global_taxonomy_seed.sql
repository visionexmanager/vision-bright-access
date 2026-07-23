-- ============================================================
-- Seed: Global Digital Library taxonomy (Phase 11)
--
-- Extends the 6-category Phase 2 demo seed with the ~28 named subjects from
-- the Global Digital Library spec. library_categories is already
-- hierarchical and open-ended (no schema change needed for "unlimited
-- collections") — this just seeds real rows. Where a spec subject already
-- has an equivalent category (History, Self Development, Mystery ->
-- Mystery & Thriller, Novels -> Fiction), it is reused rather than
-- duplicated; only Fantasy is added as a new child of the existing Fiction
-- row. Fixed literal UUIDs continuing the ca100000-...-00000000NNNN
-- sequence from the Phase 2 seed, ON CONFLICT (id) DO NOTHING so
-- re-running this migration is a no-op.
-- ============================================================

INSERT INTO public.library_categories (id, parent_id, name, slug, description, icon, display_order)
VALUES
  ('ca100000-0000-4000-8000-000000000007', NULL, 'Technology', 'technology', 'Computing, software, and the tools shaping the future', 'Cpu', 10),
  ('ca100000-0000-4000-8000-000000000008', 'ca100000-0000-4000-8000-000000000007', 'Programming', 'programming', 'Languages, frameworks, and software craft', 'Code2', 11),
  ('ca100000-0000-4000-8000-000000000009', 'ca100000-0000-4000-8000-000000000008', 'Artificial Intelligence', 'artificial-intelligence', 'Machine learning, neural networks, and AI systems', 'BrainCircuit', 12),
  ('ca100000-0000-4000-8000-000000000010', NULL, 'Medicine', 'medicine', 'Clinical practice, health sciences, and patient care', 'Stethoscope', 13),
  ('ca100000-0000-4000-8000-000000000011', NULL, 'Business', 'business', 'Management, strategy, and entrepreneurship', 'Briefcase', 14),
  ('ca100000-0000-4000-8000-000000000012', 'ca100000-0000-4000-8000-000000000011', 'Economics', 'economics', 'Markets, trade, and economic theory', 'TrendingUp', 15),
  ('ca100000-0000-4000-8000-000000000013', NULL, 'Psychology', 'psychology', 'The mind, behavior, and mental health', 'Brain', 16),
  ('ca100000-0000-4000-8000-000000000014', NULL, 'Religion', 'religion', 'Faith traditions and spiritual thought', 'Church', 17),
  ('ca100000-0000-4000-8000-000000000015', NULL, 'Languages', 'languages', 'Language learning and linguistics', 'Languages', 18),
  ('ca100000-0000-4000-8000-000000000016', NULL, 'Science', 'science', 'Physics, chemistry, biology, and the natural world', 'FlaskConical', 19),
  ('ca100000-0000-4000-8000-000000000017', 'ca100000-0000-4000-8000-000000000016', 'Engineering', 'engineering', 'Applied science and engineering disciplines', 'Cog', 20),
  ('ca100000-0000-4000-8000-000000000018', 'ca100000-0000-4000-8000-000000000016', 'Agriculture', 'agriculture', 'Farming, food systems, and agricultural science', 'Wheat', 21),
  ('ca100000-0000-4000-8000-000000000019', NULL, 'Cooking', 'cooking', 'Recipes, cuisines, and culinary technique', 'ChefHat', 22),
  ('ca100000-0000-4000-8000-000000000020', NULL, 'Travel', 'travel', 'Guides, memoirs, and travel writing', 'Plane', 23),
  ('ca100000-0000-4000-8000-000000000021', NULL, 'Art', 'art', 'Visual art, design, and art history', 'Palette', 24),
  ('ca100000-0000-4000-8000-000000000022', 'ca100000-0000-4000-8000-000000000021', 'Photography', 'photography', 'Technique, theory, and photo essays', 'Camera', 25),
  ('ca100000-0000-4000-8000-000000000023', 'ca100000-0000-4000-8000-000000000021', 'Music', 'music', 'Theory, history, and musicianship', 'Music', 26),
  ('ca100000-0000-4000-8000-000000000024', NULL, 'Law', 'law', 'Legal systems, case studies, and jurisprudence', 'Scale', 27),
  ('ca100000-0000-4000-8000-000000000025', NULL, 'Politics', 'politics', 'Government, policy, and political thought', 'Vote', 28),
  ('ca100000-0000-4000-8000-000000000026', NULL, 'Education', 'education', 'Teaching, learning theory, and pedagogy', 'GraduationCap', 29),
  ('ca100000-0000-4000-8000-000000000027', NULL, 'Philosophy', 'philosophy', 'Ethics, logic, and the great questions', 'Lightbulb', 30),
  ('ca100000-0000-4000-8000-000000000028', NULL, 'Children', 'children', 'Picture books and stories for young readers', 'Baby', 31),
  ('ca100000-0000-4000-8000-000000000029', NULL, 'Biography', 'biography', 'Lives, memoirs, and true stories of real people', 'UserCircle', 32),
  ('ca100000-0000-4000-8000-000000000030', 'ca100000-0000-4000-8000-000000000001', 'Fantasy', 'fantasy', 'Magic, myth, and imagined worlds', 'Wand2', 33)
ON CONFLICT (id) DO NOTHING;
