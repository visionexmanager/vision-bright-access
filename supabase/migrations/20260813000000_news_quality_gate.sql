-- A news item must pass the ingestion quality gate before it can be included
-- in the public digest. Existing generated rows are held for review rather
-- than silently trusted.
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'review_required',
  ADD COLUMN IF NOT EXISTS category_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_published_at timestamptz;

ALTER TABLE public.news_articles
  DROP CONSTRAINT IF EXISTS news_articles_quality_status_check;

ALTER TABLE public.news_articles
  ADD CONSTRAINT news_articles_quality_status_check
  CHECK (quality_status IN ('verified', 'review_required', 'rejected'));

ALTER TABLE public.news_articles
  DROP CONSTRAINT IF EXISTS news_articles_category_confidence_check;

ALTER TABLE public.news_articles
  ADD CONSTRAINT news_articles_category_confidence_check
  CHECK (category_confidence IS NULL OR category_confidence BETWEEN 0 AND 1);

CREATE INDEX IF NOT EXISTS idx_news_articles_digest_quality
  ON public.news_articles (published_at DESC)
  WHERE published = true AND quality_status = 'verified';
