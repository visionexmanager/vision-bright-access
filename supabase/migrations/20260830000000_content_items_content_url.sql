-- Content Hub delivery target.
--
-- `content_items` previously stored only card metadata (title, level, points,
-- duration). The /content page charged VX on the call-to-action and then had
-- nothing to open, so a purchase produced a toast and no material. This adds
-- the destination the CTA opens.
--
-- Nullable on purpose: existing rows keep working and simply render without a
-- paid CTA until an admin fills the URL in /admin/content. RLS is unchanged —
-- the column inherits the existing published/admin policies on the table.

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS content_url text;

-- Only absolute http(s) destinations. Blocks javascript:, data: and relative
-- values that would otherwise be rendered straight into an anchor href.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.content_items'::regclass
      AND conname = 'content_items_content_url_http'
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_content_url_http
      CHECK (content_url IS NULL OR content_url ~* '^https?://[^\s]+$');
  END IF;
END $$;

COMMENT ON COLUMN public.content_items.content_url IS
  'Absolute http(s) URL the Content Hub CTA opens after unlock. NULL means the item is not deliverable yet and must not be charged for.';
