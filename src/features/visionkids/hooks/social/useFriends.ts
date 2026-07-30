import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as friends from "@/features/visionkids/services/social/friends";

export function useMyFriendships() {
  return useQuery({ queryKey: ["kids-social", "friendships"], queryFn: friends.fetchMyFriendships });
}

export function useProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ["kids-social", "profiles", [...userIds].sort()],
    queryFn: () => friends.fetchProfiles(userIds),
    enabled: userIds.length > 0,
  });
}

function invalidateFriendships(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["kids-social", "friendships"] });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (addresseeId: string) => friends.sendFriendRequest(addresseeId), onSuccess: () => invalidateFriendships(qc) });
}

export function useRespondFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ friendshipId, accept }: { friendshipId: string; accept: boolean }) => friends.respondFriendRequest(friendshipId, accept),
    onSuccess: () => { invalidateFriendships(qc); qc.invalidateQueries({ queryKey: ["kids", "achievements"] }); },
  });
}

export function useRemoveFriendship() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (friendshipId: string) => friends.removeFriendship(friendshipId), onSuccess: () => invalidateFriendships(qc) });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (friendshipId: string) => friends.blockUser(friendshipId), onSuccess: () => invalidateFriendships(qc) });
}

export function useFavoriteFriendIds() {
  return useQuery({ queryKey: ["kids-social", "favorite-friends"], queryFn: friends.fetchFavoriteFriendIds });
}

export function useToggleFavoriteFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ friendUserId, isFavorite }: { friendUserId: string; isFavorite: boolean }) => friends.toggleFavoriteFriend(friendUserId, isFavorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "favorite-friends"] }),
  });
}

export function useMyMutedUserIds() {
  return useQuery({ queryKey: ["kids-social", "muted-users"], queryFn: friends.fetchMyMutedUserIds });
}

export function useMuteUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => friends.muteUser(userId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "muted-users"] }) });
}

export function useUnmuteUser() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (userId: string) => friends.unmuteUser(userId), onSuccess: () => qc.invalidateQueries({ queryKey: ["kids-social", "muted-users"] }) });
}
