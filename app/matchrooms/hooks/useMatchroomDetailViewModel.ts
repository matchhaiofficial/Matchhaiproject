import { useCallback, useMemo } from "react";
import { GameSkillScore, SkillTier } from "../../../src/services/skillRatingService";
import {
  isRoomExpired,
  isRoomLocked,
} from "../../../src/utils/matchroomLifecycle";
import {
  deriveMatchroomLobbyState,
  normalizeWalkInSkillTier,
} from "../utils/matchroomLobbyState";

type Params = {
  room: any;
  currentIdentityValues: Array<string | null | undefined>;
  playerRatings: Record<string, GameSkillScore | null>;
  identityMatches: (
    candidate: unknown,
    values: Array<string | null | undefined>,
  ) => boolean;
};

type SkillBadgeProps =
  | {
    tier: SkillTier;
    rating?: number;
    showRating: true;
  }
  | {
    tier: SkillTier;
    showRating: false;
  }
  | null;

export function useMatchroomDetailViewModel({
  room,
  currentIdentityValues,
  playerRatings,
  identityMatches,
}: Params) {
  const isHost = useMemo(
    () => identityMatches(room?.hostUid, currentIdentityValues),
    [currentIdentityValues, identityMatches, room?.hostUid],
  );
  const isExpired = useMemo(() => (room ? isRoomExpired(room) : false), [room]);
  const isLocked = useMemo(() => (room ? isRoomLocked(room) : false), [room]);
  const lobbyState = useMemo(
    () => deriveMatchroomLobbyState(room, currentIdentityValues),
    [currentIdentityValues, room],
  );
  const canJoin = useMemo(
    () =>
      !isExpired &&
      !isLocked &&
      !lobbyState.isJoined &&
      !lobbyState.isFull,
    [isExpired, isLocked, lobbyState.isFull, lobbyState.isJoined],
  );

  const captainUidAResolved = room?.captainUidA || room?.hostUid;
  const captainUidBResolved = room?.captainUidB || null;
  const canManageTeamA =
    isHost ||
    (!!captainUidAResolved &&
      identityMatches(captainUidAResolved, currentIdentityValues));
  const canManageTeamB =
    isHost ||
    (!!captainUidBResolved &&
      identityMatches(captainUidBResolved, currentIdentityValues)) ||
    (!captainUidBResolved && isHost);
  const canInviteTeamA =
    !!captainUidAResolved &&
    identityMatches(captainUidAResolved, currentIdentityValues);
  const canInviteTeamB =
    !!captainUidBResolved &&
    identityMatches(captainUidBResolved, currentIdentityValues);

  const getSkillBadgeProps = useCallback(
    (uid?: string, fallbackTierRaw?: unknown): SkillBadgeProps => {
      if (uid && playerRatings[uid]) {
        return {
          tier: playerRatings[uid]!.tier,
          rating: playerRatings[uid]!.rating,
          showRating: true,
        };
      }

      const walkInTier = normalizeWalkInSkillTier(fallbackTierRaw);

      if (walkInTier) {
        return {
          tier: walkInTier,
          showRating: false,
        };
      }

      return null;
    },
    [playerRatings]
  );

  return {
    isHost,
    isExpired,
    isLocked,
    canJoin,
    captainUidAResolved,
    captainUidBResolved,
    canManageTeamA,
    canManageTeamB,
    canInviteTeamA,
    canInviteTeamB,
    getSkillBadgeProps,
    ...lobbyState,
  };
}
