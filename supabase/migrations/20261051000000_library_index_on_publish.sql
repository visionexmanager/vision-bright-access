-- Library search found nothing because nothing was ever indexed.
--
-- Semantic search reads library_books.embedding. The only writers are the
-- Studio's manual "Classify with AI" button and the background worker's
-- classify_and_index_book job — and the only path that queued that job was
-- the import-review approval. A book published any other way was never
-- indexed: on 2026-09-27, 8 of 8 published books had no embedding and the job
-- queue had never held a row (library-search-health.yml).
--
-- This queues the job whenever a book becomes published without an
-- embedding, and once now for every such book already published. The worker
-- itself is called on a schedule by library-jobs-cron.yml.
--
-- Additive and re-runnable: CREATE OR REPLACE, DROP TRIGGER IF EXISTS, and a
-- backfill that skips a book with a job already waiting.

CREATE OR REPLACE FUNCTION public.library_queue_index_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.publish_status = 'published'
     AND NEW.embedding IS NULL
     AND (TG_OP = 'INSERT' OR OLD.publish_status IS DISTINCT FROM 'published')
     AND NOT EXISTS (
       SELECT 1 FROM public.library_background_jobs j
        WHERE j.job_type = 'classify_and_index_book'
          AND j.status IN ('pending', 'processing')
          AND j.payload ->> 'book_id' = NEW.id::text
     )
  THEN
    INSERT INTO public.library_background_jobs (job_type, payload)
    VALUES ('classify_and_index_book', jsonb_build_object('book_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

-- A trigger function: run by the trigger, never called by anyone.
REVOKE ALL ON FUNCTION public.library_queue_index_on_publish() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS library_books_queue_index_on_publish ON public.library_books;
CREATE TRIGGER library_books_queue_index_on_publish
  AFTER INSERT OR UPDATE OF publish_status ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.library_queue_index_on_publish();

-- Once, for the books already published and never indexed.
INSERT INTO public.library_background_jobs (job_type, payload)
SELECT 'classify_and_index_book', jsonb_build_object('book_id', b.id)
  FROM public.library_books b
 WHERE b.publish_status = 'published'
   AND b.embedding IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.library_background_jobs j
      WHERE j.job_type = 'classify_and_index_book'
        AND j.status IN ('pending', 'processing')
        AND j.payload ->> 'book_id' = b.id::text
   );
