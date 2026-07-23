// ─── Library — Discussion Boards (Phase 12: Reading Community) ────────────
// Shared by per-book discussions (public) and per-club discussions
// (member-only) — RLS enforces the visibility split server-side (see the
// migration's can_access_library_discussion_topic()).

import { supabase } from "@/integrations/supabase/client";

export type LibraryDiscussionContext = "book" | "club";

export interface LibraryDiscussionTopicRow {
  id: string;
  context_type: LibraryDiscussionContext;
  context_id: string;
  author_id: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  is_spoiler: boolean;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

const TOPIC_SELECT = "id, context_type, context_id, author_id, title, body, is_pinned, is_locked, is_spoiler, reply_count, last_activity_at, created_at";

async function resolveAuthors(userIds: string[]): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const map = new Map<string, { name: string; avatarUrl: string | null }>();
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return map;
  const { data, error } = await supabase.rpc("get_library_public_profile_summaries", { _user_ids: unique });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>) {
    map.set(row.user_id, { name: row.display_name ?? "Reader", avatarUrl: row.avatar_url ?? null });
  }
  return map;
}

export async function fetchDiscussionTopics(contextType: LibraryDiscussionContext, contextId: string, query = ""): Promise<LibraryDiscussionTopicRow[]> {
  let q = supabase.from("library_discussion_topics").select(TOPIC_SELECT).eq("context_type", contextType).eq("context_id", contextId)
    .order("is_pinned", { ascending: false }).order("last_activity_at", { ascending: false });
  if (query.trim()) q = q.textSearch("search_vector", query.trim());
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<LibraryDiscussionTopicRow, "authorName" | "authorAvatarUrl">[];
  const authors = await resolveAuthors(rows.map((r) => r.author_id));
  return rows.map((r) => ({ ...r, authorName: authors.get(r.author_id)?.name ?? "Reader", authorAvatarUrl: authors.get(r.author_id)?.avatarUrl ?? null }));
}

export async function fetchDiscussionTopic(topicId: string): Promise<LibraryDiscussionTopicRow | null> {
  const { data, error } = await supabase.from("library_discussion_topics").select(TOPIC_SELECT).eq("id", topicId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const authors = await resolveAuthors([data.author_id]);
  return { ...data, authorName: authors.get(data.author_id)?.name ?? "Reader", authorAvatarUrl: authors.get(data.author_id)?.avatarUrl ?? null };
}

export async function createDiscussionTopic(contextType: LibraryDiscussionContext, contextId: string, authorId: string, title: string, body: string | null, isSpoiler: boolean): Promise<LibraryDiscussionTopicRow> {
  const { data, error } = await supabase.from("library_discussion_topics").insert({
    context_type: contextType, context_id: contextId, author_id: authorId, title: title.trim(), body: body?.trim() || null, is_spoiler: isSpoiler,
  }).select(TOPIC_SELECT).single();
  if (error) throw new Error(error.message);
  return { ...data, authorName: "", authorAvatarUrl: null };
}

export async function setTopicPinned(topicId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("library_discussion_topics").update({ is_pinned: pinned }).eq("id", topicId);
  if (error) throw new Error(error.message);
}

export async function setTopicLocked(topicId: string, locked: boolean): Promise<void> {
  const { error } = await supabase.from("library_discussion_topics").update({ is_locked: locked }).eq("id", topicId);
  if (error) throw new Error(error.message);
}

export async function deleteDiscussionTopic(topicId: string): Promise<void> {
  const { error } = await supabase.from("library_discussion_topics").delete().eq("id", topicId);
  if (error) throw new Error(error.message);
}

export interface LibrarySimilarTopic {
  id: string;
  title: string;
  similarity: number;
}

export async function findSimilarTopics(contextType: LibraryDiscussionContext, contextId: string, title: string): Promise<LibrarySimilarTopic[]> {
  if (title.trim().length < 4) return [];
  const { data, error } = await supabase.rpc("find_similar_library_discussion_topics", { _context_type: contextType, _context_id: contextId, _title: title.trim(), _match_limit: 5 });
  if (error) throw new Error(error.message);
  return (data ?? []) as LibrarySimilarTopic[];
}

export interface LibraryDiscussionReplyRow {
  id: string;
  topic_id: string;
  parent_reply_id: string | null;
  quoted_reply_id: string | null;
  author_id: string;
  body: string;
  mentioned_user_ids: string[];
  image_urls: string[];
  is_spoiler: boolean;
  likes_count: number;
  created_at: string;
  authorName: string;
  authorAvatarUrl: string | null;
  likedByMe: boolean;
}

export async function fetchDiscussionReplies(topicId: string, viewerId?: string): Promise<LibraryDiscussionReplyRow[]> {
  const { data, error } = await supabase.from("library_discussion_replies").select("*").eq("topic_id", topicId).order("created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<LibraryDiscussionReplyRow, "authorName" | "authorAvatarUrl" | "likedByMe">[];
  if (rows.length === 0) return [];

  const [authors, likedIds] = await Promise.all([
    resolveAuthors(rows.map((r) => r.author_id)),
    viewerId
      ? supabase.from("library_discussion_reply_likes").select("reply_id").eq("user_id", viewerId).in("reply_id", rows.map((r) => r.id)).then(({ data }) => new Set((data ?? []).map((d) => d.reply_id)))
      : Promise.resolve(new Set<string>()),
  ]);

  return rows.map((r) => ({
    ...r,
    authorName: authors.get(r.author_id)?.name ?? "Reader",
    authorAvatarUrl: authors.get(r.author_id)?.avatarUrl ?? null,
    likedByMe: likedIds.has(r.id),
  }));
}

export interface LibraryReplyInput {
  parentReplyId?: string | null;
  quotedReplyId?: string | null;
  mentionedUserIds?: string[];
  imageUrls?: string[];
  isSpoiler?: boolean;
}

export async function createDiscussionReply(topicId: string, authorId: string, body: string, input: LibraryReplyInput = {}): Promise<void> {
  const { error } = await supabase.from("library_discussion_replies").insert({
    topic_id: topicId, author_id: authorId, body: body.trim(),
    parent_reply_id: input.parentReplyId ?? null,
    quoted_reply_id: input.quotedReplyId ?? null,
    mentioned_user_ids: input.mentionedUserIds ?? [],
    image_urls: input.imageUrls ?? [],
    is_spoiler: input.isSpoiler ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function deleteDiscussionReply(replyId: string): Promise<void> {
  const { error } = await supabase.from("library_discussion_replies").delete().eq("id", replyId);
  if (error) throw new Error(error.message);
}

export async function toggleReplyLike(replyId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase.from("library_discussion_reply_likes").delete().eq("reply_id", replyId).eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("library_discussion_reply_likes").insert({ reply_id: replyId, user_id: userId });
    if (error) throw new Error(error.message);
  }
}

export async function uploadDiscussionImage(authorId: string, file: File): Promise<string> {
  const path = `${authorId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from("library-discussion-media").upload(path, file);
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("library-discussion-media").getPublicUrl(path);
  return data.publicUrl;
}

export interface LibraryDiscussionPollRow {
  id: string;
  topic_id: string;
  question: string;
  options: Array<{ id: string; label: string }>;
  closes_at: string | null;
}

export async function fetchDiscussionPoll(topicId: string): Promise<{ poll: LibraryDiscussionPollRow; votesByOption: Record<string, number>; myVote: string | null } | null> {
  const { data: poll, error } = await supabase.from("library_discussion_polls").select("*").eq("topic_id", topicId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!poll) return null;

  const { data: votes, error: votesErr } = await supabase.from("library_discussion_poll_votes").select("option_id, user_id").eq("poll_id", poll.id);
  if (votesErr) throw new Error(votesErr.message);

  const votesByOption: Record<string, number> = {};
  for (const v of votes ?? []) votesByOption[v.option_id] = (votesByOption[v.option_id] ?? 0) + 1;

  const { data: { user } } = await supabase.auth.getUser();
  const myVote = user ? (votes ?? []).find((v) => v.user_id === user.id)?.option_id ?? null : null;

  return { poll: poll as LibraryDiscussionPollRow, votesByOption, myVote };
}

export async function createDiscussionPoll(topicId: string, question: string, options: string[], closesAt: string | null): Promise<void> {
  const { error } = await supabase.from("library_discussion_polls").insert({
    topic_id: topicId, question: question.trim(),
    options: options.map((label, i) => ({ id: `opt-${i}`, label })),
    closes_at: closesAt,
  });
  if (error) throw new Error(error.message);
}

export async function voteOnPoll(pollId: string, userId: string, optionId: string): Promise<void> {
  const { error } = await supabase.from("library_discussion_poll_votes").upsert({ poll_id: pollId, user_id: userId, option_id: optionId }, { onConflict: "poll_id,user_id" });
  if (error) throw new Error(error.message);
}
