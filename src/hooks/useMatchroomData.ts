// src/hooks/useMatchroomData.ts
// Convex-based real-time hooks for matchroom detail screen

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";

const MATCH_JOIN_REQUEST_TYPE = "match.join_request";

/**
 * Hook for getting user's outgoing join requests for a matchroom
 */
export function useMyJoinRequests(matchroomId: string | undefined) {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const notifications = useQuery(
    api.notifications.listByFromUidAndType,
    userId
      ? {
          fromUid: userId,
          type: MATCH_JOIN_REQUEST_TYPE,
          limit: 50,
        }
      : "skip"
  );

  const bookingIntents = useQuery(
    api.bookings.listActiveIntentsByUserForMatchroom,
    userId && matchroomId
      ? { userId, matchroomId: matchroomId as Id<"matchrooms"> }
      : "skip"
  );

  // Filter to the specific matchroom and get slot statuses
  const requestedSlots = new Map<string, string>();
  let genericRequestStatus: string | null = null;
  const activeIntentIds: string[] = [];

  if (notifications && matchroomId) {
    notifications.forEach((n: any) => {
      const isActiveRequest = n.status === "pending";
      if (
        isActiveRequest &&
        (n.data?.matchroomId === matchroomId || n.matchroomId === matchroomId)
      ) {
        if (n.data?.slotId) {
          requestedSlots.set(n.data.slotId, n.status);
        } else {
          genericRequestStatus = n.status;
        }
      }
    });
  }

  if (bookingIntents && matchroomId) {
    bookingIntents.forEach((intent: any) => {
      activeIntentIds.push(String(intent._id));
      const slotIds = Array.isArray(intent.selectedSlotIds)
        ? intent.selectedSlotIds
        : [];

      if (slotIds.length > 0) {
        slotIds.forEach((slotId: string) => {
          requestedSlots.set(slotId, intent.status);
        });
      } else if (!genericRequestStatus) {
        genericRequestStatus = intent.status;
      }
    });
  }

  return {
    requestedSlots,
    genericRequestStatus,
    activeIntentIds,
    loading: notifications === undefined || bookingIntents === undefined,
  };
}

/**
 * Hook for active matchroom states across list surfaces.
 * Includes pending join requests and unpaid booking intents that still reserve a room for the user.
 */
export function useMyActiveMatchroomRoomStates() {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const notifications = useQuery(
    api.notifications.listByFromUidAndType,
    userId
      ? {
          fromUid: userId,
          type: MATCH_JOIN_REQUEST_TYPE,
          limit: 100,
        }
      : "skip"
  );

  const bookingIntents = useQuery(
    api.bookings.listActiveIntentsByUser,
    userId ? { userId } : "skip"
  );

  const roomStatuses = new Map<string, string>();
  const activeIntentIdsByRoom = new Map<string, string[]>();

  if (notifications) {
    notifications.forEach((notification: any) => {
      const matchroomId = notification.matchroomId || notification.data?.matchroomId;
      if (!matchroomId || notification.status !== "pending") {
        return;
      }
      roomStatuses.set(String(matchroomId), "pending");
    });
  }

  if (bookingIntents) {
    bookingIntents.forEach((intent: any) => {
      if (!intent.matchroomId) {
        return;
      }

      const roomId = String(intent.matchroomId);
      const existingIntentIds = activeIntentIdsByRoom.get(roomId) || [];
      activeIntentIdsByRoom.set(roomId, [...existingIntentIds, String(intent._id)]);

      const existingStatus = roomStatuses.get(roomId);
      if (intent.status === "approved_pending_payment" || !existingStatus) {
        roomStatuses.set(roomId, intent.status);
      }
    });
  }

  return {
    roomStatuses,
    activeIntentIdsByRoom,
    loading: notifications === undefined || bookingIntents === undefined,
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
