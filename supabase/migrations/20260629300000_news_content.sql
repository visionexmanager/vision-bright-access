-- Full article body for newsletter emails
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content text;

-- Bilingual translations: { "en": {title, description, content}, "ar": {...} }
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS translations jsonb;

-- Preferred language per subscriber (defaults to Arabic)
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'ar';
