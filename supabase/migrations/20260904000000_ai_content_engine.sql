-- Phase 7: AI Content Engine + Owner Approval.
--
-- The engine discovers opportunities in Visionex's own semantic index, drafts a
-- proposal, and stops. A human decides. Nothing here can publish: see the
-- transition trigger below, where PUBLISHED exists in the vocabulary and has no
-- inbound edge at all. Publishing is a later migration adding that edge plus a
-- platform adapter, not a flag somebody can flip.
--
-- No second approval engine. Every proposal is paired with an owner_approvals
-- row of the existing `content_publish` action type and decided by the existing
-- decide_owner_approval(). No second semantic index: discovery reads the
-- ai_embeddings table through the existing match_embeddings().
--
-- Learning is contextual only. content_memory stores sentences that are read
-- back into a prompt. Nothing in this migration can change model routing,
-- provider settings, prices, margins, permissions, or code.

-- ── Vocabularies ────────────────────────────────────────────────────────────
--
-- `section` is deliberately the exact set of source_table values that
-- embed-content actually indexes, not a marketing taxonomy. A section that is
-- not indexed cannot be discovered, so allowing one here would only let the
-- model invent a topic with no evidence behind it. Library, news, arcade games
-- and "features" are absent for that reason — they are not in ai_embeddings.

CREATE TABLE IF NOT EXISTS public.content_proposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Short and dictatable, same alphabet as approvals so the owner reads one
  -- kind of reference across the whole control centre.
  proposal_ref  text NOT NULL UNIQUE DEFAULT public.generate_action_reference(),

  content_type  text NOT NULL CHECK (content_type IN (
                  'post', 'short_video', 'reel', 'story', 'article', 'carousel')),

  section       text NOT NULL CHECK (section IN (
                  'products', 'content_items', 'academy_courses', 'kids_games',
                  'simulations', 'tv_channels', 'radio_stations', 'communities',
                  'events', 'jobs', 'services')),

  -- Proposal data only. Nothing in this table is dispatched anywhere.
  platform      text NOT NULL CHECK (platform IN (
                  'facebook', 'instagram', 'tiktok', 'youtube', 'website', 'newsletter')),

  topic         text NOT NULL,
  -- Normalised form used for exact-duplicate detection.
  topic_key     text NOT NULL,
  -- Used for near-duplicate detection against earlier proposals.
  topic_embedding vector(1536),

  hook          text NOT NULL,
  body          text NOT NULL,
  hashtags      text[] NOT NULL DEFAULT '{}',
  rationale     text NOT NULL,
  target_audience text,
  language      text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),

  -- Which indexed rows the model was shown. This is what makes "why did the AI
  -- propose this" answerable months later.
  source_refs   jsonb NOT NULL DEFAULT '[]',

  proposed_publish_at timestamptz,

  state         text NOT NULL DEFAULT 'PROPOSED'
                CHECK (state IN (
                  'PROPOSED', 'EDITED', 'APPROVED', 'SCHEDULED',
                  'REJECTED', 'SUPERSEDED', 'PUBLISHED')),

  approval_id   uuid REFERENCES public.owner_approvals(id) ON DELETE SET NULL,

  -- "Ask AI for another": the old proposal is never edited in place.
  supersedes_id    uuid REFERENCES public.content_proposals(id) ON DELETE SET NULL,
  superseded_by_id uuid REFERENCES public.content_proposals(id) ON DELETE SET NULL,
  revision      integer NOT NULL DEFAULT 1,

  rejection_reason text,
  owner_notes   text,

  generated_by  text NOT NULL DEFAULT 'content-writer',
  generation_batch uuid,
  created_by    uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_proposals_state_idx     ON public.content_proposals (state, created_at DESC);
CREATE INDEX IF NOT EXISTS content_proposals_section_idx   ON public.content_proposals (section, content_type);
CREATE INDEX IF NOT EXISTS content_proposals_topic_key_idx ON public.content_proposals (topic_key);
CREATE INDEX IF NOT EXISTS content_proposals_embedding_idx
  ON public.content_proposals USING ivfflat (topic_embedding vector_cosine_ops) WITH (lists = 50);

-- Exact-duplicate guard, layer 1 of 3. Scoped to proposals that are still
-- alive: a rejected topic must still be *recorded* (that is how the engine
-- learns not to repeat it), so terminal rows are excluded from the constraint
-- rather than deleted.
CREATE UNIQUE INDEX IF NOT EXISTS content_proposals_live_topic_uniq
  ON public.content_proposals (section, content_type, topic_key)
  WHERE state IN ('PROPOSED', 'EDITED', 'APPROVED', 'SCHEDULED');

COMMENT ON TABLE public.content_proposals IS
  'AI content proposals awaiting owner decision. source_refs records which ai_embeddings rows seeded each proposal. Nothing here is published; see enforce_content_proposal_transition().';

-- ── Calendar ────────────────────────────────────────────────────────────────
--
-- Planning only. There is no external identifier column and no PUBLISHED slot
-- state, because there is nothing to publish to yet. Adding Facebook or TikTok
-- later means adding columns here plus an adapter, and nothing in this phase
-- pretends that work is done.

CREATE TABLE IF NOT EXISTS public.content_calendar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id   uuid NOT NULL REFERENCES public.content_proposals(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  platform      text NOT NULL CHECK (platform IN (
                  'facebook', 'instagram', 'tiktok', 'youtube', 'website', 'newsletter')),
  slot_state    text NOT NULL DEFAULT 'PLANNED' CHECK (slot_state IN ('PLANNED', 'CANCELLED')),
  note          text,
  created_by    uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, platform)
);

CREATE INDEX IF NOT EXISTS content_calendar_due_idx ON public.content_calendar (scheduled_for, slot_state);

COMMENT ON TABLE public.content_calendar IS
  'Planned slots for approved content. Phase 7 does not publish: no external post id, no PUBLISHED slot state, no adapter.';

-- ── Memory ──────────────────────────────────────────────────────────────────
--
-- Distinct from ai_feedback_events, which is the append-only event log of what
-- happened. This table is the distilled, re-readable form: the sentences the
-- next generation is actually shown. One is history, the other is instruction.

CREATE TABLE IF NOT EXISTS public.content_memory (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_type   text NOT NULL CHECK (memory_type IN (
                  'approved_topic', 'rejected_topic', 'avoid_topic',
                  'style_preference', 'successful_angle')),
  section       text CHECK (section IN (
                  'products', 'content_items', 'academy_courses', 'kids_games',
                  'simulations', 'tv_channels', 'radio_stations', 'communities',
                  'events', 'jobs', 'services')),
  content_type  text,
  topic         text,
  topic_key     text,
  angle         text,
  embedding     vector(1536),
  -- The sentence handed back to the model. Plain language on purpose: it is
  -- read by a prompt, not executed.
  lesson        text NOT NULL,
  weight        integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 5),
  proposal_id   uuid REFERENCES public.content_proposals(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_memory_lookup_idx ON public.content_memory (memory_type, section, created_at DESC);
CREATE INDEX IF NOT EXISTS content_memory_topic_key_idx ON public.content_memory (topic_key);
CREATE INDEX IF NOT EXISTS content_memory_embedding_idx
  ON public.content_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

COMMENT ON TABLE public.content_memory IS
  'Distilled contextual learning read back into generation prompts. Never changes routing, prompts on disk, permissions, pricing, or code.';

-- ── Transition enforcement ──────────────────────────────────────────────────
--
-- PUBLISHED is in the CHECK vocabulary and appears in no _allowed array. There
-- is therefore no sequence of legal moves that reaches it, which is what makes
-- "the AI can never publish by itself" a property of the database rather than a
-- promise in a comment.

CREATE OR REPLACE FUNCTION public.enforce_content_proposal_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _allowed text[];
BEGIN
  IF NEW.state = OLD.state THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  _allowed := CASE OLD.state
    WHEN 'PROPOSED'  THEN ARRAY['EDITED', 'APPROVED', 'REJECTED', 'SUPERSEDED']
    WHEN 'EDITED'    THEN ARRAY['EDITED', 'APPROVED', 'REJECTED', 'SUPERSEDED']
    WHEN 'APPROVED'  THEN ARRAY['SCHEDULED', 'REJECTED']
    -- Terminal in Phase 7. A scheduled slot is a plan, not a queued send.
    WHEN 'SCHEDULED' THEN ARRAY[]::text[]
    WHEN 'REJECTED'   THEN ARRAY[]::text[]
    WHEN 'SUPERSEDED' THEN ARRAY[]::text[]
    WHEN 'PUBLISHED'  THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.state = ANY (_allowed)) THEN
    RAISE EXCEPTION 'Illegal content proposal transition % -> % for %', OLD.state, NEW.state, OLD.proposal_ref
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_proposals_transition ON public.content_proposals;
CREATE TRIGGER content_proposals_transition
  BEFORE UPDATE ON public.content_proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_proposal_transition();

-- ── Near-duplicate detection (layer 2 of 3) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_content_proposals(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.88,
  lookback_days   int   DEFAULT 90,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id          uuid,
  proposal_ref text,
  topic       text,
  section     text,
  state       text,
  similarity  float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.proposal_ref, p.topic, p.section, p.state,
         1 - (p.topic_embedding <=> query_embedding) AS similarity
    FROM public.content_proposals p
   WHERE p.topic_embedding IS NOT NULL
     AND p.created_at > now() - make_interval(days => greatest(lookback_days, 1))
     AND 1 - (p.topic_embedding <=> query_embedding) >= match_threshold
   ORDER BY p.topic_embedding <=> query_embedding
   LIMIT greatest(match_count, 1);
$$;

REVOKE ALL ON FUNCTION public.match_content_proposals(vector, float, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_content_proposals(vector, float, int, int) TO service_role;

-- ── Source/topic cooldown (layer 3 of 3) ────────────────────────────────────
--
-- Stops the same indexed row being mined repeatedly. Reads source_refs rather
-- than a separate ledger, so the cooldown is derived from the proposals
-- themselves and cannot drift out of step with them.

CREATE OR REPLACE FUNCTION public.content_sources_in_cooldown(
  _source_ids text[],
  _cooldown_days int DEFAULT 30
)
RETURNS TABLE (source_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ref->>'source_id' AS source_id
    FROM public.content_proposals p
    CROSS JOIN LATERAL jsonb_array_elements(p.source_refs) AS ref
   WHERE p.created_at > now() - make_interval(days => greatest(_cooldown_days, 1))
     AND p.state <> 'SUPERSEDED'
     AND ref->>'source_id' = ANY (_source_ids);
$$;

REVOKE ALL ON FUNCTION public.content_sources_in_cooldown(text[], int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_sources_in_cooldown(text[], int) TO service_role;

-- ── Create a proposal ───────────────────────────────────────────────────────
--
-- One transaction for the proposal and its paired approval. Doing this from the
-- edge function in two calls would leave a proposal with no approval, or an
-- approval with no proposal, whenever the second insert failed — and the first
-- of those is a proposal nobody can decide.
--
-- The exact-duplicate index is caught here rather than pre-checked in the
-- caller, because a pre-check is a race: two runs can both read "no duplicate"
-- before either inserts.

CREATE OR REPLACE FUNCTION public.create_content_proposal(
  _proposal jsonb,
  _actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approval_id  uuid;
  _reference    text;
  _row          public.content_proposals%ROWTYPE;
  _supersedes   uuid;
BEGIN
  _supersedes := NULLIF(_proposal->>'supersedes_id', '')::uuid;

  INSERT INTO public.owner_approvals (action_type, title, summary, payload)
  VALUES (
    'content_publish',
    left(coalesce(_proposal->>'hook', _proposal->>'topic', 'Content proposal'), 200),
    _proposal->>'rationale',
    jsonb_build_object(
      'section', _proposal->>'section',
      'content_type', _proposal->>'content_type',
      'platform', _proposal->>'platform',
      'topic', _proposal->>'topic',
      'source_refs', coalesce(_proposal->'source_refs', '[]'::jsonb)
    )
  )
  RETURNING id, reference INTO _approval_id, _reference;

  BEGIN
    INSERT INTO public.content_proposals (
      content_type, section, platform, topic, topic_key, topic_embedding,
      hook, body, hashtags, rationale, target_audience, language,
      source_refs, proposed_publish_at, approval_id, supersedes_id,
      generation_batch, created_by
    )
    VALUES (
      _proposal->>'content_type',
      _proposal->>'section',
      _proposal->>'platform',
      _proposal->>'topic',
      _proposal->>'topic_key',
      NULLIF(_proposal->>'topic_embedding', '')::vector,
      _proposal->>'hook',
      _proposal->>'body',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_proposal->'hashtags')), '{}'),
      _proposal->>'rationale',
      _proposal->>'target_audience',
      COALESCE(_proposal->>'language', 'en'),
      COALESCE(_proposal->'source_refs', '[]'::jsonb),
      NULLIF(_proposal->>'proposed_publish_at', '')::timestamptz,
      _approval_id,
      _supersedes,
      NULLIF(_proposal->>'generation_batch', '')::uuid,
      _actor_id
    )
    RETURNING * INTO _row;
  EXCEPTION WHEN unique_violation THEN
    -- Layer 1 of duplicate prevention, enforced by the index rather than by a
    -- check the caller could skip.
    RAISE EXCEPTION 'duplicate_topic' USING ERRCODE = 'unique_violation';
  END;

  -- "Ask AI for another" retires the previous proposal in the same transaction,
  -- so a superseded row can never be left decidable alongside its replacement.
  IF _supersedes IS NOT NULL THEN
    UPDATE public.content_proposals
       SET state = 'SUPERSEDED', superseded_by_id = _row.id
     WHERE id = _supersedes AND state IN ('PROPOSED', 'EDITED');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, 'content_proposal_created', 'content_proposal', _row.id,
          jsonb_build_object('reference', _reference, 'section', _row.section,
                             'content_type', _row.content_type));

  RETURN jsonb_build_object(
    'ok', true,
    'proposal_ref', _row.proposal_ref,
    'reference', _reference,
    'id', _row.id
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'duplicate_topic');
END;
$$;

REVOKE ALL ON FUNCTION public.create_content_proposal(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_content_proposal(jsonb, uuid) TO service_role;

-- ── Decide a proposal ───────────────────────────────────────────────────────
--
-- Wraps the existing approval engine rather than replacing it: the authority is
-- still decide_owner_approval(), and this only mirrors the outcome onto the
-- proposal and records the lesson. A proposal whose approval is already decided
-- fails here too, because that function returns not_pending.

CREATE OR REPLACE FUNCTION public.decide_content_proposal(
  _proposal_ref text,
  _approve      boolean,
  _actor_id     uuid,
  _note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proposal public.content_proposals%ROWTYPE;
  _approval public.owner_approvals%ROWTYPE;
  _decision jsonb;
BEGIN
  SELECT * INTO _proposal FROM public.content_proposals
   WHERE proposal_ref = upper(_proposal_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _proposal.state NOT IN ('PROPOSED', 'EDITED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending', 'state', _proposal.state);
  END IF;

  SELECT * INTO _approval FROM public.owner_approvals WHERE id = _proposal.approval_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'approval_missing');
  END IF;

  -- The existing engine is the one that decides. If it refuses (already
  -- decided, expired), this whole call refuses with it.
  _decision := public.decide_owner_approval(
    _approval.reference, _approve, 'admin_ui', _actor_id::text, _note
  );

  IF NOT (_decision->>'ok')::boolean THEN
    RETURN _decision;
  END IF;

  UPDATE public.content_proposals
     SET state = CASE WHEN _approve THEN 'APPROVED' ELSE 'REJECTED' END,
         rejection_reason = CASE WHEN _approve THEN NULL ELSE _note END,
         owner_notes = COALESCE(_note, owner_notes)
   WHERE id = _proposal.id
  RETURNING * INTO _proposal;

  INSERT INTO public.ai_feedback_events
    (event_type, channel, user_id, subject_type, subject_id, summary, detail)
  VALUES (
    CASE WHEN _approve THEN 'owner_approval' ELSE 'owner_rejection' END,
    'admin_ui', _actor_id, 'content_proposal', _proposal.proposal_ref,
    CASE WHEN _approve THEN 'Owner approved content proposal ' ELSE 'Owner rejected content proposal ' END
      || _proposal.proposal_ref,
    jsonb_build_object('note', _note, 'section', _proposal.section,
                       'content_type', _proposal.content_type, 'topic', _proposal.topic)
  );

  -- The lesson, in the form the next prompt reads.
  INSERT INTO public.content_memory
    (memory_type, section, content_type, topic, topic_key, angle, embedding, lesson, proposal_id)
  VALUES (
    CASE WHEN _approve THEN 'approved_topic' ELSE 'rejected_topic' END,
    _proposal.section, _proposal.content_type, _proposal.topic, _proposal.topic_key,
    _proposal.hook, _proposal.topic_embedding,
    CASE WHEN _approve
      THEN 'The owner approved a ' || _proposal.content_type || ' about "' || _proposal.topic || '". This angle works.'
      ELSE 'The owner rejected a ' || _proposal.content_type || ' about "' || _proposal.topic || '".'
             || COALESCE(' Reason: ' || _note, '') || ' Do not propose this topic again in any rewording.'
    END,
    _proposal.id
  );

  RETURN jsonb_build_object('ok', true, 'state', _proposal.state, 'reference', _approval.reference);
END;
$$;

REVOKE ALL ON FUNCTION public.decide_content_proposal(text, boolean, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_content_proposal(text, boolean, uuid, text) TO service_role;

-- ── Record an owner edit ────────────────────────────────────────────────────
--
-- before/after and the note live in ai_feedback_events.detail, which is the
-- existing correction log. No parallel revision table: one history, not two.

CREATE OR REPLACE FUNCTION public.record_content_proposal_edit(
  _proposal_ref text,
  _actor_id     uuid,
  _hook         text,
  _body         text,
  _hashtags     text[],
  _proposed_publish_at timestamptz,
  _note         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before public.content_proposals%ROWTYPE;
  _after  public.content_proposals%ROWTYPE;
BEGIN
  SELECT * INTO _before FROM public.content_proposals WHERE proposal_ref = upper(_proposal_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _before.state NOT IN ('PROPOSED', 'EDITED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_editable', 'state', _before.state);
  END IF;

  UPDATE public.content_proposals
     SET hook = COALESCE(_hook, hook),
         body = COALESCE(_body, body),
         hashtags = COALESCE(_hashtags, hashtags),
         proposed_publish_at = COALESCE(_proposed_publish_at, proposed_publish_at),
         owner_notes = COALESCE(_note, owner_notes),
         revision = revision + 1,
         state = 'EDITED'
   WHERE id = _before.id
  RETURNING * INTO _after;

  INSERT INTO public.ai_feedback_events
    (event_type, channel, user_id, subject_type, subject_id, summary, detail)
  VALUES (
    'owner_correction', 'admin_ui', _actor_id, 'content_proposal', _before.proposal_ref,
    'Owner edited content proposal ' || _before.proposal_ref,
    jsonb_build_object(
      'note', _note,
      'revision', _after.revision,
      'before', jsonb_build_object('hook', _before.hook, 'body', _before.body,
                                   'hashtags', to_jsonb(_before.hashtags),
                                   'proposed_publish_at', _before.proposed_publish_at),
      'after',  jsonb_build_object('hook', _after.hook, 'body', _after.body,
                                   'hashtags', to_jsonb(_after.hashtags),
                                   'proposed_publish_at', _after.proposed_publish_at),
      'changed', (ARRAY(
        SELECT unnest(ARRAY['hook', 'body', 'hashtags', 'proposed_publish_at'])
        EXCEPT SELECT unnest(ARRAY[
          CASE WHEN _before.hook IS NOT DISTINCT FROM _after.hook THEN NULL ELSE 'hook' END,
          CASE WHEN _before.body IS NOT DISTINCT FROM _after.body THEN NULL ELSE 'body' END,
          CASE WHEN _before.hashtags IS NOT DISTINCT FROM _after.hashtags THEN NULL ELSE 'hashtags' END,
          CASE WHEN _before.proposed_publish_at IS NOT DISTINCT FROM _after.proposed_publish_at
               THEN NULL ELSE 'proposed_publish_at' END])
      ))
    )
  );

  INSERT INTO public.content_memory
    (memory_type, section, content_type, topic, topic_key, angle, embedding, lesson, proposal_id)
  VALUES (
    'style_preference', _before.section, _before.content_type, _before.topic, _before.topic_key,
    _after.hook, _before.topic_embedding,
    'The owner rewrote a ' || _before.content_type || ' about "' || _before.topic
      || '". Prefer the owner''s wording and tone over the original draft.'
      || COALESCE(' Note: ' || _note, ''),
    _before.id
  );

  RETURN jsonb_build_object('ok', true, 'revision', _after.revision, 'state', _after.state);
END;
$$;

REVOKE ALL ON FUNCTION public.record_content_proposal_edit(text, uuid, text, text, text[], timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_content_proposal_edit(text, uuid, text, text, text[], timestamptz, text) TO service_role;

-- ── Schedule an approved proposal ───────────────────────────────────────────
--
-- Records a plan. Deliberately does not enqueue anything, and there is no
-- worker on the other side of this table in Phase 7.

CREATE OR REPLACE FUNCTION public.schedule_content_proposal(
  _proposal_ref  text,
  _scheduled_for timestamptz,
  _actor_id      uuid,
  _note          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proposal public.content_proposals%ROWTYPE;
BEGIN
  SELECT * INTO _proposal FROM public.content_proposals WHERE proposal_ref = upper(_proposal_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Approval first, always. The trigger would refuse this anyway; failing here
  -- gives the caller a reason instead of an exception.
  IF _proposal.state <> 'APPROVED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_approved', 'state', _proposal.state);
  END IF;

  INSERT INTO public.content_calendar (proposal_id, scheduled_for, platform, note, created_by)
  VALUES (_proposal.id, _scheduled_for, _proposal.platform, _note, _actor_id)
  ON CONFLICT (proposal_id, platform)
  DO UPDATE SET scheduled_for = EXCLUDED.scheduled_for,
                slot_state = 'PLANNED',
                note = EXCLUDED.note,
                updated_at = now();

  UPDATE public.content_proposals SET state = 'SCHEDULED' WHERE id = _proposal.id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, 'content_proposal_scheduled', 'content_proposal', _proposal.id,
          jsonb_build_object('scheduled_for', _scheduled_for, 'platform', _proposal.platform));

  RETURN jsonb_build_object('ok', true, 'state', 'SCHEDULED', 'scheduled_for', _scheduled_for);
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_content_proposal(text, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_content_proposal(text, timestamptz, uuid, text) TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Admin read only, on all three. No write policy anywhere: every write in this
-- file happens through a SECURITY DEFINER function granted to service_role and
-- reached only via owner-control, which checks the caller's role first. A
-- browser holding an admin session still cannot INSERT a proposal directly.

ALTER TABLE public.content_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'content_proposals' AND policyname = 'Admins read content proposals') THEN
    CREATE POLICY "Admins read content proposals"
      ON public.content_proposals FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'content_calendar' AND policyname = 'Admins read content calendar') THEN
    CREATE POLICY "Admins read content calendar"
      ON public.content_calendar FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'content_memory' AND policyname = 'Admins read content memory') THEN
    CREATE POLICY "Admins read content memory"
      ON public.content_memory FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
