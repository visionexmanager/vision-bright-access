-- ============================================================
-- Migration: VisionKids World (Phase 12) — per-child progress: homes,
-- inventory, quest progress, region visits, transport unlocks, settings, and
-- an audit log.
--
-- PRIVACY / SECURITY: every table is per-child under strict owner-only RLS.
-- No personal data beyond a child-chosen home name and lightweight JSONB
-- layout/config. The audit log is writable only by SECURITY DEFINER RPCs
-- (no client INSERT policy) and readable only by its owner.
-- ============================================================

-- ============================================================
-- kids_world_homes — one home per child. `rooms` is a JSONB layout the child
-- arranges; `theme` is a cosmetic preset. Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_homes (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Home',
  theme       TEXT NOT NULL DEFAULT 'cozy' CHECK (theme IN ('cozy', 'modern', 'space', 'nature', 'candy')),
  rooms       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_world_homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_homes: owner reads"
  ON public.kids_world_homes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_world_homes: owner writes"
  ON public.kids_world_homes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_world_homes: owner updates"
  ON public.kids_world_homes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_world_inventory — items a child owns (bought in the Marketplace or
-- granted). Placement columns let owned furniture/decor be arranged in a room.
-- Rows are created only by the buy_kids_item RPC (no client INSERT policy);
-- placement updates are owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_inventory (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_slug   TEXT NOT NULL REFERENCES public.kids_marketplace_items(slug) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  placed      BOOLEAN NOT NULL DEFAULT FALSE,
  room        TEXT,
  pos_x       NUMERIC(5,2),
  pos_y       NUMERIC(5,2),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_slug)
);

ALTER TABLE public.kids_world_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_inventory: owner reads"
  ON public.kids_world_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_world_inventory: owner updates"
  ON public.kids_world_inventory FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- No INSERT policy on purpose: rows are minted only by buy_kids_item (SECURITY DEFINER).

CREATE INDEX IF NOT EXISTS idx_kids_world_inventory_user ON public.kids_world_inventory(user_id, category);

-- ============================================================
-- kids_quest_progress — a child's status on a world activity/quest. For
-- daily/weekly/seasonal quests, `period_start` windows the completion so it
-- can repeat each period. Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_quest_progress (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id  UUID NOT NULL REFERENCES public.kids_world_activities(id) ON DELETE CASCADE,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('active', 'completed')),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, activity_id, period_start)
);

ALTER TABLE public.kids_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_quest_progress: owner reads"
  ON public.kids_quest_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_quest_progress: owner writes"
  ON public.kids_quest_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_quest_progress: owner updates"
  ON public.kids_quest_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_quest_progress_user ON public.kids_quest_progress(user_id);

-- ============================================================
-- kids_region_visits — which regions a child has discovered (World Passport
-- stamps). Owner-only; rows minted by visit_kids_region.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_region_visits (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_slug     TEXT NOT NULL,
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, region_slug)
);

ALTER TABLE public.kids_region_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_region_visits: owner reads"
  ON public.kids_region_visits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_region_visits: owner writes"
  ON public.kids_region_visits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_transport_unlocks — transport modes a child has unlocked. Owner-only;
-- rows minted by unlock_kids_transport (which checks the achievement).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_transport_unlocks (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transport_slug TEXT NOT NULL REFERENCES public.kids_transportation(slug) ON DELETE CASCADE,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, transport_slug)
);

ALTER TABLE public.kids_transport_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_transport_unlocks: owner reads"
  ON public.kids_transport_unlocks FOR SELECT USING (auth.uid() = user_id);
-- No client INSERT policy: minted by unlock_kids_transport (SECURITY DEFINER).

-- ============================================================
-- kids_world_settings — per-child world preferences: chosen transport, chosen
-- weather, and world accessibility toggles. Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_transport TEXT NOT NULL DEFAULT 'walk',
  weather           TEXT NOT NULL DEFAULT 'auto' CHECK (weather IN ('auto', 'sunny', 'night', 'rain', 'snow', 'wind')),
  audio_navigation  BOOLEAN NOT NULL DEFAULT FALSE,
  voice_commands    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_world_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_settings: owner reads"
  ON public.kids_world_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_world_settings: owner writes"
  ON public.kids_world_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_world_settings: owner updates"
  ON public.kids_world_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_world_audit — lightweight audit trail of sensitive world actions
-- (purchases, home saves). Written ONLY by SECURITY DEFINER RPCs (no client
-- INSERT policy); a child can read their own trail.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_world_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_world_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_world_audit: owner reads"
  ON public.kids_world_audit FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
-- No client INSERT policy: written only by SECURITY DEFINER RPCs.

CREATE INDEX IF NOT EXISTS idx_kids_world_audit_user ON public.kids_world_audit(user_id, created_at DESC);
