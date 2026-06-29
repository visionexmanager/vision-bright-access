-- Add content column for full article body (used in newsletter emails)
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS content text;
