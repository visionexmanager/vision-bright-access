-- AI semantic search (RAG) — pgvector embeddings store + similarity match.
-- Embeddings are produced by OpenAI text-embedding-3-small (1536 dims) via the
-- `embed-content` edge function and queried by the `ai-search` edge function.

create extension if not exists vector;

-- Generic embeddings store. One row per source record (products, content_items, …).
create table if not exists public.ai_embeddings (
  id           uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id    uuid not null,
  content      text not null,            -- the text that was embedded
  embedding    vector(1536),
  updated_at   timestamptz not null default now(),
  unique (source_table, source_id)
);

-- Approximate-nearest-neighbour index (cosine distance).
create index if not exists ai_embeddings_embedding_idx
  on public.ai_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists ai_embeddings_source_idx
  on public.ai_embeddings (source_table);

-- RLS: readable by authenticated users; writes happen only via the service role
-- (edge functions), which bypasses RLS — so no insert/update/delete policies.
alter table public.ai_embeddings enable row level security;

drop policy if exists "ai_embeddings_read" on public.ai_embeddings;
create policy "ai_embeddings_read"
  on public.ai_embeddings
  for select
  to authenticated
  using (true);

-- Similarity search. Returns the closest rows by cosine similarity.
create or replace function public.match_embeddings(
  query_embedding vector(1536),
  match_count int default 8,
  filter_source text default null
)
returns table (
  source_table text,
  source_id uuid,
  content text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.source_table,
    e.source_id,
    e.content,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.ai_embeddings e
  where (filter_source is null or e.source_table = filter_source)
    and e.embedding is not null
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_embeddings(vector, int, text) to anon, authenticated;
