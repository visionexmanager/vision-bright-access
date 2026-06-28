-- AI Media Studio — Speech Studio schema
-- Tables: ams_voices, ams_voice_favorites, ams_voice_recent, ams_speech_presets, ams_speech_jobs

-- ─── VOICE LIBRARY ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_voices (
  id                   text PRIMARY KEY,           -- e.g. "openai-alloy"
  name                 text NOT NULL,
  provider             text NOT NULL DEFAULT 'openai',
  provider_voice_id    text NOT NULL,              -- native ID sent to provider API
  gender               text CHECK (gender IN ('male','female','neutral')),
  age_style            text DEFAULT 'middle',      -- young / middle / mature
  accent               text DEFAULT 'american',
  language             text NOT NULL DEFAULT 'en',
  supported_languages  text[] NOT NULL DEFAULT '{}',
  description          text,
  tags                 text[] NOT NULL DEFAULT '{}',
  category             text NOT NULL DEFAULT 'general',
  is_premium           boolean NOT NULL DEFAULT false,
  sample_url           text,                       -- optional preview audio URL
  requires_model       text,                       -- null = any model
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_voices_provider_idx  ON ams_voices(provider);
CREATE INDEX IF NOT EXISTS ams_voices_gender_idx    ON ams_voices(gender);
CREATE INDEX IF NOT EXISTS ams_voices_category_idx  ON ams_voices(category);

-- Public read — no RLS needed (voices are not user-specific)
ALTER TABLE ams_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_voices_public_read" ON ams_voices FOR SELECT USING (true);

-- ─── VOICE FAVORITES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_voice_favorites (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id   text REFERENCES ams_voices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, voice_id)
);

ALTER TABLE ams_voice_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_vfav_owner_all" ON ams_voice_favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── VOICE RECENT ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_voice_recent (
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id  text REFERENCES ams_voices(id) ON DELETE CASCADE,
  used_at   timestamptz NOT NULL DEFAULT now(),
  use_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, voice_id)
);

ALTER TABLE ams_voice_recent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_vrecent_owner_all" ON ams_voice_recent
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── SPEECH PRESETS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_speech_presets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  voice_id      text NOT NULL,
  language      text NOT NULL DEFAULT 'en',
  emotion       text NOT NULL DEFAULT 'neutral',
  speed         numeric(4,2) NOT NULL DEFAULT 1.0 CHECK (speed BETWEEN 0.25 AND 4.0),
  pitch         integer NOT NULL DEFAULT 0 CHECK (pitch BETWEEN -20 AND 20),
  output_format text NOT NULL DEFAULT 'mp3' CHECK (output_format IN ('mp3','wav','flac','opus','aac')),
  model         text NOT NULL DEFAULT 'tts-1',
  provider      text NOT NULL DEFAULT 'openai',
  is_favorite   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ams_presets_user_idx ON ams_speech_presets(user_id);

ALTER TABLE ams_speech_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_presets_owner_all" ON ams_speech_presets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── SPEECH JOBS (generation history + queue) ────────────────────────────────
CREATE TABLE IF NOT EXISTS ams_speech_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id      uuid REFERENCES ams_projects(id) ON DELETE SET NULL,
  asset_id        uuid REFERENCES ams_assets(id) ON DELETE SET NULL,

  -- Input
  input_text      text NOT NULL,
  voice_id        text NOT NULL,
  voice_name      text,
  language        text NOT NULL DEFAULT 'en',
  emotion         text NOT NULL DEFAULT 'neutral',
  speed           numeric(4,2) NOT NULL DEFAULT 1.0,
  pitch           integer NOT NULL DEFAULT 0,
  output_format   text NOT NULL DEFAULT 'mp3',
  model           text NOT NULL DEFAULT 'tts-1',
  provider        text NOT NULL DEFAULT 'openai',

  -- Preset reference
  preset_id       uuid REFERENCES ams_speech_presets(id) ON DELETE SET NULL,
  preset_name     text,

  -- Output
  public_url      text,
  storage_path    text,
  duration_sec    numeric,
  file_size_bytes bigint,

  -- Status
  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','processing','completed','failed','cancelled')),
  error_message   text,
  retry_count     integer NOT NULL DEFAULT 0,

  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS ams_jobs_user_idx    ON ams_speech_jobs(user_id);
CREATE INDEX IF NOT EXISTS ams_jobs_project_idx ON ams_speech_jobs(project_id);
CREATE INDEX IF NOT EXISTS ams_jobs_status_idx  ON ams_speech_jobs(status);
CREATE INDEX IF NOT EXISTS ams_jobs_created_idx ON ams_speech_jobs(created_at DESC);

ALTER TABLE ams_speech_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ams_jobs_owner_all" ON ams_speech_jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── TRIGGER: presets updated_at ─────────────────────────────────────────────
CREATE TRIGGER ams_speech_presets_updated_at
  BEFORE UPDATE ON ams_speech_presets
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── RPC: record voice usage ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ams_record_voice_usage(p_voice_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ams_voice_recent(user_id, voice_id, used_at, use_count)
  VALUES (auth.uid(), p_voice_id, now(), 1)
  ON CONFLICT (user_id, voice_id) DO UPDATE SET
    used_at   = now(),
    use_count = ams_voice_recent.use_count + 1;
END;
$$;

-- ─── SEED VOICE LIBRARY ──────────────────────────────────────────────────────
INSERT INTO ams_voices(id, name, provider, provider_voice_id, gender, age_style, accent, language, supported_languages, description, tags, category, is_premium, sort_order)
VALUES
  -- OpenAI Standard voices (tts-1 / tts-1-hd)
  ('openai-alloy',   'Alloy',   'openai', 'alloy',   'neutral', 'middle', 'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur','ja','ko','it','nl','pl'],
   'Balanced and confident. A versatile neutral voice ideal for professional narration, presentations, and general content.',
   ARRAY['professional','versatile','neutral','balanced'], 'general', false, 10),

  ('openai-echo',    'Echo',    'openai', 'echo',    'male',    'middle', 'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur','ja','ko','it','nl','pl'],
   'Warm and measured. A calm male voice with a slightly deeper tone, great for educational and thoughtful content.',
   ARRAY['warm','calm','educational','authoritative'], 'education', false, 20),

  ('openai-fable',   'Fable',   'openai', 'fable',   'neutral', 'young',  'british',  'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur'],
   'Expressive British accent. Perfect for storytelling, audiobooks, and creative content with a distinctive flair.',
   ARRAY['storytelling','british','creative','expressive'], 'creative', false, 30),

  ('openai-nova',    'Nova',    'openai', 'nova',    'female',  'young',  'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur','ja','ko','it','nl','pl'],
   'Energetic and engaging. A bright female voice that works exceptionally well for marketing, social media, and dynamic content.',
   ARRAY['energetic','bright','marketing','engaging'], 'media', false, 40),

  ('openai-onyx',    'Onyx',    'openai', 'onyx',    'male',    'mature', 'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur','ja','ko','it','nl','pl'],
   'Deep and authoritative. A powerful male voice with gravitas, ideal for news broadcasting, documentaries, and corporate content.',
   ARRAY['deep','authoritative','news','corporate','documentary'], 'news', false, 50),

  ('openai-shimmer', 'Shimmer', 'openai', 'shimmer', 'female',  'middle', 'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur','ja','ko','it','nl','pl'],
   'Clear and expressive. A versatile female voice with natural warmth, suitable for a wide range of content types.',
   ARRAY['clear','expressive','versatile','warm'], 'general', false, 60),

  -- OpenAI HD voices (tts-1-hd and newer models)
  ('openai-ash',     'Ash',     'openai', 'ash',     'male',    'young',  'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur'],
   'Modern and relatable. A young male voice with contemporary energy, great for tech content, tutorials, and digital media.',
   ARRAY['modern','tech','tutorial','digital','casual'], 'tech', false, 70),

  ('openai-ballad',  'Ballad',  'openai', 'ballad',  'male',    'young',  'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt'],
   'Melodic and expressive. A unique voice with musical qualities, perfect for creative storytelling and emotionally resonant content.',
   ARRAY['creative','melodic','expressive','storytelling','unique'], 'creative', false, 80),

  ('openai-coral',   'Coral',   'openid', 'coral',   'female',  'young',  'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr'],
   'Warm and conversational. A natural-sounding female voice ideal for customer service, assistants, and conversational AI.',
   ARRAY['conversational','warm','customer-service','assistant','natural'], 'assistant', false, 90),

  ('openai-sage',    'Sage',    'openai', 'sage',    'neutral', 'mature', 'american', 'en',
   ARRAY['en','ar','es','fr','de','zh','hi','pt','ru','tr','ur'],
   'Calm and knowledgeable. A composed neutral voice with authority, ideal for educational content, wellness, and meditation.',
   ARRAY['calm','educational','wellness','meditation','composed'], 'wellness', false, 100)

ON CONFLICT (id) DO NOTHING;
