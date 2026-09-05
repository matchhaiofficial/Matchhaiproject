import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../src/context/AuthContext";
import {
  useFriendsForInvite,
  useIncomingJoinRequests,
  useMyJoinRequests,
  usePlayerSkillScores,
} from "../../../src/hooks/useMatchroomData";
import { useToast } from "../../../src/hooks/useToast";
import {
  getMatchroom,
  Matchroom,
} from "../../../src/services/convex/matchService";
import { GameSkillScore } from "../../../src/services/skillRatingService";
import { getUserProfile } from "../../../src/services/userService";
import Logger from "../../../src/utils/logger";
import { getMatchroomSkillLookupUserIds } from "../../../src/utils/matchroomParticipantIds";

const identityMatches = (
  candidate: unknown,
  values: Array<string | null | undefined>,
) => {
  if (!candidate) return false;
  const candidateValue = String(candidate);
  return values.some(
    (value) => value != null && String(value) === candidateValue,
  );
};

const isZoneAdminProfile = (profile: any) => {
  const role = String(profile?.role || "").toLowerCase();
  const accountType = String(profile?.accountType || "").toLowerCase();
  return (
    role === "zone-admin" ||
    role === "zone_admin" ||
    role === "super-admin" ||
    role === "super_admin" ||
    accountType === "zone" ||
    accountType === "zone_admin" ||
    accountType === "super_admin"
  );
};

type Params = { id: string };

export function useMatchroomDetailState({ id }: Params) {
  const router = useRouter();
  const { user, authUser, refreshSession, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const showToastRef = useRef(showToast);
  const routerRef = useRef(router);
  showToastRef.current = showToast;
  routerRef.current = router;

  const [room, setRoom] = useState<Matchroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestedSlots, setRequestedSlots] = useState<Map<string, string>>(new Map());
  const [genericRequestStatus, setGenericRequestStatus] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [playerRatings, setPlayerRatings] = useState<Record<string, GameSkillScore | null>>({});
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;

  const currentIdentityValues = useMemo(
    () => [user?._id, authUser?.id],
    [authUser?.id, user?._id],
  );

  const isHostEarly = useMemo(
    () => identityMatches(room?.hostUid, currentIdentityValues),
    [room?.hostUid, currentIdentityValues],
  );
  const isAdminEarly = useMemo(
    () => isZoneAdminProfile(profile),
    [profile],
  );

  // ─── Convex data ─────────────────────────────────────────────
  const myJoinRequests = useMyJoinRequests(id);
  const incomingJoinRequests = useIncomingJoinRequests(id, id.length > 0 && (isHostEarly || isAdminEarly));
  const playerUids = useMemo(
    () => getMatchroomSkillLookupUserIds(room),
    [room],
  );
  const skillScores = usePlayerSkillScores(playerUids, room?.game);
  const friendsData = useFriendsForInvite();

  // ─── Stabilised values (prevents infinite loops) ─────────────────
  const stableRequestedSlots = useMemo(() => myJoinRequests.requestedSlots, [myJoinRequests.requestedSlots]);
  const stableGenericStatus = useMemo(() => myJoinRequests.genericRequestStatus, [myJoinRequests.genericRequestStatus]);
  const stableIncoming = useMemo(() => incomingJoinRequests.requests, [incomingJoinRequests.requests]);
  const stableRatings = useMemo(() => skillScores.ratings, [skillScores.ratings]);

  // ─── Safe state updates (only when data actually changes) ────────
  useEffect(() => {
    setRequestedSlots((prev) => {
      if (prev.size !== stableRequestedSlots.size) return stableRequestedSlots;
      for (const [k, v] of stableRequestedSlots.entries()) {
        if (prev.get(k) !== v) return stableRequestedSlots;
      }
      return prev;
    });
  }, [stableRequestedSlots]);

  useEffect(() => {
    setGenericRequestStatus((prev) =>
      prev === stableGenericStatus ? prev : stableGenericStatus,
    );
  }, [stableGenericStatus]);

  useEffect(() => {
    setIncomingRequests((prev) => {
      if (prev.length !== stableIncoming.length) return stableIncoming;
      const prevIds = prev.map((r: any) => r._id ?? r.id).join(",");
      const nextIds = stableIncoming.map((r: any) => r._id ?? r.id).join(",");
      return prevIds === nextIds ? prev : stableIncoming;
    });
  }, [stableIncoming]);

  useEffect(() => {
    setPlayerRatings((prev) => {
      try {
        return JSON.stringify(prev) === JSON.stringify(stableRatings) ? prev : (stableRatings as Record<string, GameSkillScore | null>);
      } catch {
        return stableRatings as Record<string, GameSkillScore | null>;
      }
    });
  }, [stableRatings]);

  // ─── Fetch room (with guard) ─────────────────────────────────────
  const fetchRoom = useCallback(async (options?: { refreshFirst?: boolean; retryPublicProjection?: boolean }) => {
    if (!id || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (options?.refreshFirst) {
        await refreshSessionRef.current();
      }

      let res = await getMatchroom(id);
      const hasAuthenticatedContext = Boolean(user?._id || authUser?.id);
      if (
        options?.retryPublicProjection !== false &&
        hasAuthenticatedContext &&
        res.ok &&
        res.data?.accessLevel === "public"
      ) {
        const refreshed = await refreshSessionRef.current();
        if (refreshed) {
          await new Promise((resolve) => setTimeout(resolve, 150));
          const retry = await getMatchroom(id);
          if (retry.ok && retry.data) {
            res = retry;
          }
        }
      }

      if (res.ok && res.data) {
        setRoom(res.data);
      } else {
        showToastRef.current({
          message: "Matchroom not found.",
          title: "Load failed",
          type: "error",
        });
        routerRef.current.back();
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error fetching room", e);
      showToastRef.current({
        message: "Failed to load matchroom details.",
        title: "Load failed",
        type: "error",
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [authUser?.id, id, user?._id]);

  useEffect(() => {
    if (authLoading) return;
    void fetchRoom();
  }, [authLoading, fetchRoom]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      void fetchRoom({ refreshFirst: true });
    }, [authLoading, fetchRoom]),
  );

  useEffect(() => {
    if (!user?._id) return;
    getUserProfile(user._id).then((res) => {
      if (res.ok) {
        setProfile((prev: any) =>
          JSON.stringify(prev) === JSON.stringify(res.data) ? prev : res.data
        );
      }
    });
  }, [user?._id]);

  const isZoneAdmin = isZoneAdminProfile(profile);

  const rawBookingRequestId = useMemo(() => {
    if (!room) return null;
    const raw: any = room;
    return raw.bookingRequestId || raw.requestId || raw.booking?.requestId || raw.bookingRequest?.id || null;
  }, [room]);

  useEffect(() => {
    setBookingRequestId((prev) => (prev === rawBookingRequestId ? prev : rawBookingRequestId));
  }, [rawBookingRequestId]);

  return {
    user,
    authUser,
    room,
    setRoom,
    loading,
    setLoading,
    joining,
    setJoining,
    requestedSlots,
    setRequestedSlots,
    genericRequestStatus,
    setGenericRequestStatus,
    requestLoading,
    setRequestLoading,
    incomingRequests,
    processingRequestId,
    setProcessingRequestId,
    profile,
    setProfile,
    playerRatings,
    currentIdentityValues,
    isZoneAdmin,
    bookingRequestId,
    setBookingRequestId,
    activeIntentIds: myJoinRequests.activeIntentIds,
    convexFriends: friendsData.friends,
    loadingConvexFriends: friendsData.loading,
    fetchRoom,
  };
}
