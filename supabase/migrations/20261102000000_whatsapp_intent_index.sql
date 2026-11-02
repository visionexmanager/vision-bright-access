-- A meaning index of the WhatsApp assistant's features, so a message that does
-- not use a stored phrase can still be matched to the feature it is about.
--
-- Each row is one string that describes a feature (its name in a language, its
-- description, an alias) with its embedding. The webhook builds the rows lazily
-- from the catalog and fingerprints them with `catalog_hash`; a catalog change
-- gives a new hash, the new rows are written, and rows of older hashes are
-- removed. Nothing here holds a message or anything about a sender.

CREATE TABLE IF NOT EXISTS public.whatsapp_intent_index (
  catalog_hash text NOT NULL,
  node_id      text NOT NULL,
  content      text NOT NULL,
  embedding    vector(1536) NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (catalog_hash, node_id, content)
);

ALTER TABLE public.whatsapp_intent_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_intent_index: service role only" ON public.whatsapp_intent_index;
CREATE POLICY "whatsapp_intent_index: service role only"
  ON public.whatsapp_intent_index FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Closest rows by cosine similarity, within one catalog hash.
CREATE OR REPLACE FUNCTION public.match_whatsapp_intents(
  query_embedding vector(1536),
  match_count     int,
  p_hash          text
)
RETURNS TABLE (node_id text, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.node_id, 1 - (i.embedding <=> query_embedding) AS similarity
  FROM public.whatsapp_intent_index i
  WHERE i.catalog_hash = p_hash
  ORDER BY i.embedding <=> query_embedding
  LIMIT greatest(match_count, 1);
$$;

-- Only the webhook (service role) calls this. Revoked from the public roles by
-- name, and granted back to service_role, which `FROM PUBLIC` alone also takes.
REVOKE ALL ON FUNCTION public.match_whatsapp_intents(vector, int, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_whatsapp_intents(vector, int, text) TO service_role;
