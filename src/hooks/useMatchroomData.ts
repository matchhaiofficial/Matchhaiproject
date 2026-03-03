// src/hooks/useMatchroomData.ts
// Convex-based real-time hooks for matchroom detail screen

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";

/**
 * Hook for getting user's outgoing join requests for a matchroom
 */
export function useMyJoinRequests(matchroomId: string | undefined) {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const notifications = useQuery(
    api.notifications.listByFromUid,
    userId
      ? {
          fromUid: userId,
          type: "match_join_request",
          limit: 50,
        }
      : "skip"
  );

  // Filter to the specific matchroom and get slot statuses
  const requestedSlots = new Map<string, string>();
  let genericRequestStatus: string | null = null;

  if (notifications && matchroomId) {
    notifications.forEach((n: any) => {
      if (n.data?.matchroomId === matchroomId || n.matchroomId === matchroomId) {
        if (n.data?.slotId) {
          requestedSlots.set(n.data.slotId, n.status);
        } else {
          genericRequestStatus = n.status;
        }
      }
    });
  }

  return {
    requestedSlots,
    genericRequestStatus,
    loading: notifications === undefined,
  };
}

/**
 * Hook for real-time incoming join requests for a matchroom (for hosts/admins)
 */
export function useIncomingJoinRequests(
  matchroomId: string | undefined,
  isHostOrAdmin: boolean
) {
  const requests = useQuery(
    api.notifications.listMatchroomJoinRequests,
    matchroomId && isHostOrAdmin
      ? {
          matchroomId: matchroomId as Id<"matchrooms">,
          status: "pending",
        }
      : "skip"
  );

  return {
    requests: requests || [],
    loading: requests === undefined,
  };
}

/**
 * Hook for getting player skill scores
 */
export function usePlayerSkillScores(
  playerUids: string[],
  game: string | undefined
) {
  const userIds = playerUids.map((uid) => uid as Id<"users">);

  const scores = useQuery(
    api.users.getSkillScores,
    game && userIds.length > 0
      ? {
          userIds,
          game,
        }
      : "skip"
  );

  return {
    ratings: scores || {},
    loading: scores === undefined,
  };
}

/**
 * Hook for getting friends list for invitations
 */
export function useFriendsForInvite() {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const friends = useQuery(
    api.social.listFriends,
    userId ? { userId } : "skip"
  );

  // Transform to include uid field for compatibility
  const friendsList = friends?.map((f: any) => ({
    id: f.friendshipId,
    uid: f.friendId,
    username: f.username,
    fullName: f.fullName,
    photoURL: f.photoURL,
    isOnline: f.isOnline,
  })) || [];

  return {
    friends: friendsList,
    loading: friends === undefined,
  };
}

/**
 * Hook for getting booking request ID by matchroom
 * Note: This is a placeholder - the actual linkage between matchrooms
 * and booking requests may need to be implemented based on the booking flow
 */
export function useBookingRequestForMatchroom(
  matchroomId: string | undefined,
  isZoneAdmin: boolean
) {
  // For now, booking requests are not directly linked to matchrooms in the schema
  // This may need to be updated based on how the booking flow links them
  return {
    requestId: undefined as string | undefined,
    request: undefined,
    loading: false,
  };
}
