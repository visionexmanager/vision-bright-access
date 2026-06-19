-- Persistent, user-owned AI companion memory.
-- This stores compact preferences and usage patterns, not full chat transcripts.

CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  user_id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  preferred_language TEXT,
  preferred_tone     TEXT,
  accessibility_needs TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  interests          TEXT[]     NOT NULL DEFAULT ARRAY[]::TEXT[],
  frequent_sections  JSONB      NOT NULL DEFAULT '{}'::JSONB,
  last_context       JSONB      NOT NULL DEFAULT '{}'::JSONB,
  summary            TEXT       NOT NULL DEFAULT '',
  interaction_count  INTEGER    NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_user_memory_own_select" ON public.ai_user_memory;
CREATE POLICY "ai_user_memory_own_select"
  ON public.ai_user_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_user_memory_own_insert" ON public.ai_user_memory;
CREATE POLICY "ai_user_memory_own_insert"
  ON public.ai_user_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_user_memory_own_update" ON public.ai_user_memory;
CREATE POLICY "ai_user_memory_own_update"
  ON public.ai_user_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_user_memory_own_delete" ON public.ai_user_memory;
CREATE POLICY "ai_user_memory_own_delete"
  ON public.ai_user_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_user_memory_updated_at
  ON public.ai_user_memory(updated_at DESC);
