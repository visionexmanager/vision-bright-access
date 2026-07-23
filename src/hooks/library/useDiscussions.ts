import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/api/queryKeys";
import {
  fetchDiscussionTopics, createDiscussionTopic, setTopicPinned, setTopicLocked, deleteDiscussionTopic, findSimilarTopics,
  fetchDiscussionTopic, fetchDiscussionReplies, createDiscussionReply, deleteDiscussionReply, toggleReplyLike, uploadDiscussionImage,
  fetchDiscussionPoll, createDiscussionPoll, voteOnPoll,
  type LibraryDiscussionContext, type LibraryReplyInput,
} from "@/services/library/discussions";
import { isContentFlagged } from "@/services/library/moderation";

export function useDiscussionTopics(contextType: LibraryDiscussionContext, contextId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const { data: topics = [], isLoading } = useQuery({
    queryKey: [...queryKeys.library.discussionTopics(contextType, contextId ?? ""), query],
    queryFn: () => fetchDiscussionTopics(contextType, contextId!, query),
    enabled: !!contextId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.discussionTopics(contextType, contextId ?? "") });

  const create = async (title: string, body: string, isSpoiler: boolean) => {
    if (!contextId || !user) return null;
    try {
      const { flagged } = await isContentFlagged(`${title}\n${body}`);
      if (flagged) {
        toast({ title: "This post looks like it may violate community guidelines", description: "Please revise it and try again.", variant: "destructive" });
        return null;
      }
      const topic = await createDiscussionTopic(contextType, contextId, user.id, title, body, isSpoiler);
      invalidate();
      return topic;
    } catch (err) {
      toast({ title: "Couldn't create topic", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    }
  };

  const checkDuplicates = (title: string) => (contextId ? findSimilarTopics(contextType, contextId, title) : Promise.resolve([]));

  const pin = async (topicId: string, pinned: boolean) => { await setTopicPinned(topicId, pinned); invalidate(); };
  const lock = async (topicId: string, locked: boolean) => { await setTopicLocked(topicId, locked); invalidate(); };
  const remove = async (topicId: string) => { await deleteDiscussionTopic(topicId); invalidate(); };

  return { topics, isLoading, query, setQuery, create, checkDuplicates, pin, lock, remove };
}

export function useDiscussionThread(topicId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: topic, isLoading: isLoadingTopic } = useQuery({
    queryKey: queryKeys.library.discussionTopic(topicId ?? ""),
    queryFn: () => fetchDiscussionTopic(topicId!),
    enabled: !!topicId,
  });

  const { data: replies = [], isLoading: isLoadingReplies } = useQuery({
    queryKey: queryKeys.library.discussionReplies(topicId ?? ""),
    queryFn: () => fetchDiscussionReplies(topicId!, user?.id),
    enabled: !!topicId,
  });

  const { data: pollData } = useQuery({
    queryKey: queryKeys.library.discussionPoll(topicId ?? ""),
    queryFn: () => fetchDiscussionPoll(topicId!),
    enabled: !!topicId,
  });

  const invalidateReplies = () => void queryClient.invalidateQueries({ queryKey: queryKeys.library.discussionReplies(topicId ?? "") });

  const reply = async (body: string, input?: LibraryReplyInput) => {
    if (!topicId || !user || !body.trim()) return;
    try {
      const { flagged } = await isContentFlagged(body);
      if (flagged) {
        toast({ title: "This reply looks like it may violate community guidelines", description: "Please revise it and try again.", variant: "destructive" });
        return;
      }
      await createDiscussionReply(topicId, user.id, body, input);
      invalidateReplies();
    } catch (err) {
      toast({ title: "Couldn't post reply", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const removeReply = async (replyId: string) => {
    await deleteDiscussionReply(replyId);
    invalidateReplies();
  };

  const toggleLike = async (replyId: string, currentlyLiked: boolean) => {
    if (!user) return;
    await toggleReplyLike(replyId, user.id, currentlyLiked);
    invalidateReplies();
  };

  const uploadImage = async (file: File) => {
    if (!user) throw new Error("Must be signed in");
    return uploadDiscussionImage(user.id, file);
  };

  const createPoll = async (question: string, options: string[], closesAt: string | null) => {
    if (!topicId) return;
    await createDiscussionPoll(topicId, question, options, closesAt);
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.discussionPoll(topicId) });
  };

  const vote = async (optionId: string) => {
    if (!topicId || !user || !pollData) return;
    await voteOnPoll(pollData.poll.id, user.id, optionId);
    void queryClient.invalidateQueries({ queryKey: queryKeys.library.discussionPoll(topicId) });
  };

  return {
    topic: topic ?? null, replies, poll: pollData ?? null,
    isLoading: isLoadingTopic || isLoadingReplies,
    reply, removeReply, toggleLike, uploadImage, createPoll, vote,
  };
}
