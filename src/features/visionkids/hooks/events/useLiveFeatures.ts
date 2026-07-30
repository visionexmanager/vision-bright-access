import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import * as live from "@/features/visionkids/services/events/liveFeatures";

export function useEventMessages(eventId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;
    const channel = kidsDb
      .channel(`kids-event-messages-${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kids_event_messages", filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-events", "messages", eventId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [eventId, qc]);

  return useQuery({ queryKey: ["kids-events", "messages", eventId], queryFn: () => live.fetchEventMessages(eventId!), enabled: !!eventId });
}

export function useSendEventMessage(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => live.sendEventMessage(eventId!, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "messages", eventId] }),
  });
}

export function useEventPolls(eventId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;
    const channel = kidsDb
      .channel(`kids-event-polls-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_event_polls", filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-events", "polls", eventId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [eventId, qc]);

  return useQuery({ queryKey: ["kids-events", "polls", eventId], queryFn: () => live.fetchEventPolls(eventId!), enabled: !!eventId });
}

export function useCreatePoll(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ question, options }: { question: string; options: string[] }) => live.createPoll(eventId!, question, options),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "polls", eventId] }),
  });
}

export function useClosePoll(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (pollId: string) => live.closePoll(pollId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "polls", eventId] }) });
}

export function usePollVotes(pollId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!pollId) return;
    const channel = kidsDb
      .channel(`kids-poll-votes-${pollId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kids_event_poll_votes", filter: `poll_id=eq.${pollId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-events", "poll-votes", pollId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [pollId, qc]);

  return useQuery({ queryKey: ["kids-events", "poll-votes", pollId], queryFn: () => live.fetchPollVotes(pollId!), enabled: !!pollId });
}

export function useCastVote(pollId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (optionIndex: number) => live.castVote(pollId!, optionIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "poll-votes", pollId] }),
  });
}

export function useEventQuestions(eventId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!eventId) return;
    const channel = kidsDb
      .channel(`kids-event-questions-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kids_event_questions", filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kids-events", "questions", eventId] });
      })
      .subscribe();
    return () => { kidsDb.removeChannel(channel); };
  }, [eventId, qc]);

  return useQuery({ queryKey: ["kids-events", "questions", eventId], queryFn: () => live.fetchEventQuestions(eventId!), enabled: !!eventId });
}

export function useAskQuestion(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => live.askQuestion(eventId!, question),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "questions", eventId] }),
  });
}

export function useUpvoteQuestion(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => live.upvoteQuestion(questionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "questions", eventId] }),
  });
}

export function useAnswerQuestion(eventId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, answerText }: { questionId: string; answerText: string }) => live.answerQuestion(questionId, answerText),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-events", "questions", eventId] }),
  });
}
