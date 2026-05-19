// src/hooks/useMatchroomData.ts
// Convex-based real-time hooks for matchroom detail screen

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "../context/AuthContext";

const ACTIVE_BOOKING_INTENT_STATUSES = new Set([
  "approved_pending_payment",
  "pending_approvals",
  "approved",
]);

function isActiveBookingIntent(intent: any, now: number) {
  if (!intent || intent.paymentStatus === "paid") {
    return false;
  }

  if (!ACTIVE_BOOKING_INTENT_STATUSES.has(String(intent.status || ""))) {
    return false;
  }

  const expiresAt = Number(intent.expiresAt || 0);
  return !expiresAt || expiresAt > now;
}

/**
 * Hook for getting user's outgoing join requests for a matchroom
 */
export function useMyJoinRequests(matchroomId: string | undefined) {
  const { user } = useAuth();
  const userId = user?._id as Id<"users"> | undefined;

  const notifications = useQuery(
    api.notifications.listOutgoingMatchroomJoinRequests,
    userId && matchroomId
      ? {
        fromUid: userId,
        matchroomId: matchroomId as Id<"matchrooms">,
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

  // ─── Wrap everything in useMemo so references are stable ──────────
  const result = useMemo(() => {
    const requestedSlots = new Map<string, string>();
    let genericRequestStatus: string | null = null;
    const activeIntentIds: string[] = [];
    const now = Date.now();

    if (notifications && matchroomId) {
      notifications.forEach((n: any) => {
        if (n.status === "pending") {
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
        if (!isActiveBookingIntent(intent, now)) {
          return;
        }

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

    return { requestedSlots, genericRequestStatus, activeIntentIds };
  }, [notifications, bookingIntents, matchroomId]);
  // ──────────────────────────────────────────────────────────────────

  return {
    ...result,
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
    api.notifications.listOutgoingMatchroomJoinRequests,
    userId
      ? {
        fromUid: userId,
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
  const now = Date.now();

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
      if (!isActiveBookingIntent(intent, now)) {
        return;
      }

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

  // FIX: stabilize fallback so `|| []` doesn't produce a new reference every
  // render, which would cause the useEffect in useMatchroomDetailState to fire
  // every render even when no data has changed.
  const stableRequests = useMemo(() => requests || [], [requests]);

  return {
    requests: stableRequests,
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
  // ✅ FIX: memoize so Convex doesn't get a new args object every render
  const userIds = useMemo(
    () => playerUids.map((uid) => uid as Id<"users">),
    [playerUids],
  );

  const scores = useQuery(
    api.users.getSkillScores,
    game && userIds.length > 0 ? { userIds, game } : "skip",
  );

  const stableRatings = useMemo(() => scores || {}, [scores]);

  return {
    ratings: stableRatings,
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

  // FIX: this was the primary infinite loop cause. friends?.map(...) created new
  // object references on every render. shallowArrayEqual compares items with ===,
  // so {uid: x} !== {uid: x} (different objects) → always returned false →
  // setFriends fired every render → infinite setState loop.
  // useMemo ensures the transformed array is only recreated when `friends` actually
  // changes (i.e. when Convex pushes new data).
  const friendsList = useMemo(
    () =>
      friends?.map((f: any) => ({
        id: f.friendshipId,
        uid: f.friendId,
        username: f.username,
        fullName: f.fullName,
        photoURL: f.photoURL,
        isOnline: f.isOnline,
      })) || [],
    [friends]
  );

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
