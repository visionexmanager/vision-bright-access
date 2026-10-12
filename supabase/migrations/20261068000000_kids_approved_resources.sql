-- VisionKids: approved external educational resources.
--
-- Children never see the open web. A resource from an outside source reaches a
-- child only if an administrator looked at that one resource and approved it for
-- an age range and a subject. This table is that approval, and nothing else
-- feeds the kids shelf.
--
-- Reuses what exists rather than adding a second system:
--   - which *sources* may be used at all is a feature flag in
--     kids_ops_feature_flags (admin toggle: toggle_kids_flag, already in the
--     Feature flags page). Both flags below start OFF.
--   - admin-only writes go through has_role(), like every kids_ops_* table.
--   - the candidates are found by the existing external content registry.
--
-- What the database refuses on its own, whatever the client sends:
--   - an address that is not https on an approved host (openstax.org, or a
--     language subdomain of wikibooks.org) — so no javascript:, data:, http:,
--     userinfo@host, or look-alike domain can be stored;
--   - a resource without a Creative Commons licence name or without a credit line;
--   - an age range outside 3-17, or reversed;
--   - text beyond a fixed length, so an imported description cannot be a payload.
-- Links are always rendered as plain anchors; nothing here is ever embedded or run.

CREATE TABLE IF NOT EXISTS public.kids_approved_resources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source           text        NOT NULL CHECK (source IN ('openstax', 'wikibooks')),
  provider_item_id text        NOT NULL CHECK (char_length(provider_item_id) BETWEEN 1 AND 200),
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  summary          text        CHECK (summary IS NULL OR char_length(summary) <= 500),
  url              text        NOT NULL CHECK (
                     char_length(url) <= 500
                     AND url ~ '^https://(openstax\.org|[a-z]{2,3}\.wikibooks\.org)/[^\s<>"'']*$'
                   ),
  license_name     text        NOT NULL CHECK (license_name ~ '^CC (BY|0)' AND char_length(license_name) <= 40),
  license_url      text        CHECK (license_url IS NULL OR license_url ~ '^https://creativecommons\.org/[^\s<>"'']*$'),
  attribution      text        NOT NULL CHECK (char_length(attribution) BETWEEN 1 AND 300),
  age_min          smallint    NOT NULL CHECK (age_min BETWEEN 3 AND 17),
  age_max          smallint    NOT NULL CHECK (age_max BETWEEN 3 AND 17),
  subject          text        NOT NULL CHECK (subject IN ('math', 'science', 'language', 'social', 'technology', 'arts', 'other')),
  language         text        NOT NULL DEFAULT 'en' CHECK (language ~ '^[a-z]{2,3}$'),
  status           text        NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'disabled')),
  review_notes     text        CHECK (review_notes IS NULL OR char_length(review_notes) <= 500),
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kids_approved_resources_age_order CHECK (age_min <= age_max),
  CONSTRAINT kids_approved_resources_unique_item UNIQUE (source, provider_item_id)
);

CREATE INDEX IF NOT EXISTS idx_kids_approved_resources_shelf
  ON public.kids_approved_resources (status, subject, age_min);

ALTER TABLE public.kids_approved_resources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.kids_approved_resources FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kids_approved_resources TO authenticated;
GRANT ALL ON TABLE public.kids_approved_resources TO service_role;

-- A signed-in user reads an approved resource only while its source is switched on.
DROP POLICY IF EXISTS "kids_approved_resources: read approved" ON public.kids_approved_resources;
CREATE POLICY "kids_approved_resources: read approved"
  ON public.kids_approved_resources FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.kids_ops_feature_flags f
      WHERE f.key = 'kids_source_' || kids_approved_resources.source AND f.enabled
    )
  );

-- Administrators see and manage everything, including disabled rows.
DROP POLICY IF EXISTS "kids_approved_resources: admins" ON public.kids_approved_resources;
CREATE POLICY "kids_approved_resources: admins"
  ON public.kids_approved_resources FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

-- The two sources, switched off until an administrator turns them on.
INSERT INTO public.kids_ops_feature_flags (key, description, enabled, channel) VALUES
  ('kids_source_openstax',  'Approved OpenStax textbooks on the kids shelf',  false, 'stable'),
  ('kids_source_wikibooks', 'Approved Wikibooks titles on the kids shelf',    false, 'stable')
ON CONFLICT (key) DO NOTHING;
