-- VisionEx Career Center — automatic usage tracking (Phase 11).
--
-- Job postings map unambiguously to a company (jobs.company_id), so that
-- metric is metered automatically via trigger — no Edge Function or
-- frontend code needs to change. Candidate-search and AI-call metering are
-- intentionally NOT auto-wired here: candidate search has no dedicated
-- table/endpoint yet, and AI-call usage is keyed to individual users
-- (ai_interactions.user_id) rather than companies, so attributing it to a
-- specific company's quota would require guessing which employer a call
-- was made on behalf of. increment_career_usage()/check_career_usage_allowed()
-- (20260706030000) are ready for both metrics whenever a concrete call site
-- needs them — this only wires the one case that's unambiguous today.
--
-- This only records usage; it does not block the insert. Enforcing plan
-- limits is a product decision best made where the user gets a clear
-- upgrade prompt (frontend/Edge Function), not a silent trigger-level
-- rejection with a generic Postgres error.

CREATE OR REPLACE FUNCTION public.career_track_job_posting_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.increment_career_usage(NEW.company_id, 'job_postings', 1);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_career_track_job_posting_usage
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.career_track_job_posting_usage();
