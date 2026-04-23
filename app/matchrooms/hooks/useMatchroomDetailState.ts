import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
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
import {
  GameSkillScore,
} from "../../../src/services/skillRatingService";
import { getUserProfile } from "../../../src/services/userService";
import Logger from "../../../src/utils/logger";

const mapsEqual = (a: Map<string, string>, b: Map<string, string>) => {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [key, value] of a.entries()) {
    if (b.get(key) !== value) return false;
  }
  return true;
};

const recordEqual = <T extends Record<string, any>>(a: T, b: T) => {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

const shallowArrayEqual = (a: any[], b: any[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};

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

type Params = {
  id: string;
};

export function useMatchroomDetailState({ id }: Params) {
  const router = useRouter();
  const { user, authUser, refreshSession } = useAuth();
  const { showToast } = useToast();

  const [room, setRoom] = useState<Matchroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [requestedSlots, setRequestedSlots] = useState<Map<string, string>>(
    new Map(),
  );
  const [genericRequestStatus, setGenericRequestStatus] = useState<
    string | null
  >(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [profile, setProfile] = useState<any>(null);
  const [playerRatings, setPlayerRatings] = useState<
    Record<string, GameSkillScore | null>
  >({});
  const [bookingRequestId, setBookingRequestId] = useState<string | null>(null);

  const currentIdentityValues = useMemo(
    () => [user?._id, authUser?.id],
    [authUser?.id, user?._id],
  );
  const isHostEarly = identityMatches(room?.hostUid, currentIdentityValues);
  const isAdminEarly =
    profile?.role === "zone-admin" || profile?.role === "super-admin";

  const {
    requestedSlots: convexRequestedSlots,
    genericRequestStatus: convexGenericRequestStatus,
    activeIntentIds,
  } = useMyJoinRequests(id);
  const { requests: convexIncomingRequests } = useIncomingJoinRequests(
    id,
    id.length > 0 && (isHostEarly || isAdminEarly),
  );
  const playerUids = room?.players?.map((p: any) => p.uid) || [];
  const { ratings: convexPlayerRatings } = usePlayerSkillScores(
    playerUids,
    room?.game,
  );
  const { friends: convexFriends, loading: loadingConvexFriends } =
    useFriendsForInvite();

  useEffect(() => {
    setRequestedSlots((prev) =>
      mapsEqual(prev, convexRequestedSlots) ? prev : convexRequestedSlots,
    );
  }, [convexRequestedSlots]);

  useEffect(() => {
    setGenericRequestStatus((prev) =>
      prev === convexGenericRequestStatus ? prev : convexGenericRequestStatus,
    );
  }, [convexGenericRequestStatus]);

  useEffect(() => {
    const next = convexIncomingRequests as any[];
    setIncomingRequests((prev) => (shallowArrayEqual(prev, next) ? prev : next));
  }, [convexIncomingRequests]);

  useEffect(() => {
    const nextRatings = convexPlayerRatings as Record<
      string,
      GameSkillScore | null
    >;
    setPlayerRatings((prev) =>
      recordEqual(prev, nextRatings) ? prev : nextRatings,
    );
  }, [convexPlayerRatings]);

  const fetchRoom = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getMatchroom(id);
      if (res.ok && res.data) {
        setRoom(res.data);
      } else {
        showToast({
          message: "Matchroom not found.",
          title: "Load failed",
          type: "error",
        });
        router.back();
      }
    } catch (e) {
      Logger.error("MatchroomDetails", "Error fetching room", e);
      showToast({
        message: "Failed to load matchroom details.",
        title: "Load failed",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [id, router, showToast]);

  useEffect(() => {
    void fetchRoom();
  }, [fetchRoom, user?._id]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshSession();
    }, [refreshSession]),
  );

  useEffect(() => {
    if (!user?._id) return;
    getUserProfile(user._id).then((res) => {
      if (res.ok) setProfile(res.data);
    });
  }, [user?._id]);

  const isZoneAdmin =
    profile?.role === "zone-admin" || profile?.role === "super-admin";

  const rawBookingRequestId = useMemo(() => {
    if (!room) return null;
    const raw: any = room as any;
    return (
      raw.bookingRequestId ||
      raw.requestId ||
      raw.booking?.requestId ||
      raw.bookingRequest?.id ||
      null
    );
  }, [room]);

  useEffect(() => {
    const next = rawBookingRequestId || null;
    setBookingRequestId((prev) => (prev === next ? prev : next));
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
    activeIntentIds,
    convexFriends,
    loadingConvexFriends,
    fetchRoom,
  };
}
