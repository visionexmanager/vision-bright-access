-- news_articles: dynamic news managed by admin, tied to newsletter categories
CREATE TABLE IF NOT EXISTS news_articles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text        NOT NULL,
  description   text        NOT NULL,
  category      text        NOT NULL DEFAULT 'technology',
  icon_name     text        NOT NULL DEFAULT 'Cpu',
  published     boolean     NOT NULL DEFAULT false,
  newsletter_sent boolean   NOT NULL DEFAULT false,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles (public news feed)
CREATE POLICY "public_read_published_news" ON news_articles
  FOR SELECT USING (published = true);

-- Admins have full control
CREATE POLICY "admins_manage_news" ON news_articles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_news_articles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_news_articles_updated_at
  BEFORE UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION update_news_articles_updated_at();
