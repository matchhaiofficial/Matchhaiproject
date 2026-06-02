import { useCallback, useMemo } from "react";
import { GameSkillScore, SkillTier } from "../../../src/services/skillRatingService";
import {
  isRoomExpired,
  isJoinLocked,
  isLeaveLocked,
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
  const joinLocked = useMemo(() => (room ? isJoinLocked(room) : false), [room]);
  const leaveLocked = useMemo(() => (room ? isLeaveLocked(room) : false), [room]);
  const lobbyState = useMemo(
    () => deriveMatchroomLobbyState(room, currentIdentityValues),
    [currentIdentityValues, room],
  );
  const canJoin = useMemo(
    () =>
      !isExpired &&
      !joinLocked &&
      !lobbyState.isJoined &&
      !lobbyState.isFull,
    [isExpired, joinLocked, lobbyState.isFull, lobbyState.isJoined],
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
  // Inviting friends to open slots is only meaningful while the room can still
  // accept players: open status, not expired, and not yet join-locked
  // (locked/full/completed/cancelled rooms must not surface invite actions).
  const canInviteToRoom =
    room?.status === "open" && !isExpired && !joinLocked;
  // The host can invite to either team's open slots (Team B often has no
  // captain assigned yet); each team captain can invite to their own team.
  const canInviteTeamA =
    canInviteToRoom &&
    (isHost ||
      (!!captainUidAResolved &&
        identityMatches(captainUidAResolved, currentIdentityValues)));
  const canInviteTeamB =
    canInviteToRoom &&
    (isHost ||
      (!!captainUidBResolved &&
        identityMatches(captainUidBResolved, currentIdentityValues)));

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
    isLocked: joinLocked,
    isJoinLocked: joinLocked,
    isLeaveLocked: leaveLocked,
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
