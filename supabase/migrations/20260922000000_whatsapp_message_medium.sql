-- Which medium a message actually used.
--
-- The transcript could not answer a question anyone asks about this channel:
-- did that reply get *spoken*? An inbound voice note was recognisable only by
-- the `[voice] ` prefix the webhook writes into the body — a convention, not a
-- column — and a spoken reply left no trace at all, because the text row above
-- it is the same words and inserting a second row would have doubled the
-- transcript. So "the voice reply is broken" and "nobody has voice replies
-- switched on" looked identical from the database, which is exactly the
-- confusion that cost a day earlier in this project.
--
-- One nullable column. No new table, no second message store, nothing rewritten:
-- every existing row keeps its meaning, and `NULL` reads as "text, or written
-- before this column existed", which is true of all of them.
--
-- `kind` is left alone deliberately. It carries what a message *is* — a reply, a
-- welcome, a refusal — and is filtered on when the history is replayed to the
-- model. Medium is a different question about the same row, and widening the
-- `kind` CHECK to hold both would have made every one of those filters wrong.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS medium text
    CHECK (medium IS NULL OR medium IN ('text', 'voice'));

COMMENT ON COLUMN public.whatsapp_messages.medium IS
  'How the message travelled: voice for a transcribed note in or a spoken reply out, text otherwise. NULL means text, including every row written before this column.';
