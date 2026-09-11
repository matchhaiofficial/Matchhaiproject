import { useCallback, useEffect, useMemo, useState } from "react";

import { Id } from "../../../../convex/_generated/dataModel";
import type { Team } from "../../../../src/services/convex/teamService";
import { getTeamById } from "../../../../src/services/convex/teamService";
import type { UserProfile } from "../../../../src/services/userService";
import {
  getUserProfile,
  getUserSportRoleLabel,
} from "../../../../src/services/userService";

type Params = {
  selectedGame: string | null;
  teams: Team[];
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  userId: string | undefined;
  userProfile: UserProfile | null;
};

type TeamMode = "solo" | "team";
type TeamPaymentMode = "captain_pays_all" | "captain_pays_self";

export function useMatchroomCreateTeamBooking({
  selectedGame,
  setTeams,
  teams,
  userId,
  userProfile,
}: Params) {
  const [teamMode, setTeamMode] = useState<TeamMode>("solo");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [reservedSlots, setReservedSlots] = useState(1);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState<
    string[]
  >([]);
  const [teamPaymentMode, setTeamPaymentMode] =
    useState<TeamPaymentMode>("captain_pays_all");
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<Team | null>(
    null,
  );
  const [memberSportRoleByUid, setMemberSportRoleByUid] = useState<
    Record<string, string | null>
  >({});

  const captainedTeams = useMemo(() => {
    if (!userId) return [];
    return (teams || []).filter((team) => team.captainUid === userId);
  }, [teams, userId]);

  const isCaptainForGame = captainedTeams.length > 0;

  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null;
    return (teams || []).find((team) => team.id === selectedTeamId) || null;
  }, [selectedTeamId, teams]);

  const resolvedTeam = selectedTeamDetails || selectedTeam;

  const selectableTeamMembers = useMemo(() => {
    if (!resolvedTeam) return [];

    const members = Array.isArray(resolvedTeam.members)
      ? resolvedTeam.members
      : [];
    const memberUids = Array.isArray(resolvedTeam.memberUids)
      ? resolvedTeam.memberUids
      : [];

    const membersByUid = new Map<string, any>();
    members.forEach((member) => {
      if (member?.uid) membersByUid.set(member.uid, member);
    });

    const orderedUids =
      memberUids.length > 0 ? memberUids : Array.from(membersByUid.keys());

    return orderedUids
      .filter((uid) => !!uid && uid !== resolvedTeam.captainUid)
      .map((uid) => {
        const existing = membersByUid.get(uid);
        if (existing) return existing;
        return {
          joinedAt: null,
          role: "member" as const,
          uid,
          username: uid.slice(0, 6) + "...",
        };
      });
  }, [resolvedTeam]);

  const canUseCaptainBooking =
    isCaptainForGame && selectableTeamMembers.length > 0;

  const resetTeamBookingState = useCallback(() => {
    setTeamMode("solo");
    setSelectedTeamId(null);
    setReservedSlots(1);
    setSelectedTeamMemberUids([]);
    setTeamPaymentMode("captain_pays_all");
    setSelectedTeamDetails(null);
  }, []);

  const refreshSelectedTeam = useCallback(
    async (teamId: string) => {
      const result = await getTeamById(teamId);
      if (result.ok && result.data) {
        setSelectedTeamDetails(result.data);
        setTeams((prev) =>
          prev.map((team) => (team.id === teamId ? result.data! : team)),
        );
      }
    },
    [setTeams],
  );

  const setBookingMode = useCallback(
    (mode: TeamMode) => {
      if (mode === "team" && !canUseCaptainBooking) return;

      setTeamMode(mode);

      if (mode === "solo") {
        setSelectedTeamId(null);
        setReservedSlots(1);
        setSelectedTeamMemberUids([]);
        return;
      }

      setReservedSlots((prev) => (prev < 2 ? 2 : prev));
      setSelectedTeamId((prev) => prev || captainedTeams[0]?.id || null);
    },
    [canUseCaptainBooking, captainedTeams],
  );

  const setReservedSlotsCount = useCallback((count: number) => {
    setReservedSlots(count);
    setSelectedTeamMemberUids([]);
  }, []);

  const toggleSelectedTeamMember = useCallback(
    (uid: string) => {
      const limit = Math.max(0, reservedSlots - 1);
      setSelectedTeamMemberUids((prev) => {
        if (prev.includes(uid)) {
          return prev.filter((entry) => entry !== uid);
        }
        if (prev.length >= limit) {
          return prev;
        }
        return [...prev, uid];
      });
    },
    [reservedSlots],
  );

  useEffect(() => {
    setMemberSportRoleByUid({});
  }, [selectedGame]);

  useEffect(() => {
    if (!resolvedTeam || !selectedGame) return;

    const memberUids = Array.from(
      new Set(
        [
          resolvedTeam.captainUid,
          ...(resolvedTeam.members || []).map((member) => member.uid),
        ].filter(Boolean),
      ),
    );

    const missingUids = memberUids.filter((uid) => !(uid in memberSportRoleByUid));
    if (missingUids.length === 0) return;

    let cancelled = false;

    const fetchRoles = async () => {
      const entries = await Promise.all(
        missingUids.map(async (uid) => {
          if (uid === userId && userProfile) {
            return [uid, getUserSportRoleLabel(userProfile, selectedGame)] as const;
          }

          const result = await getUserProfile(uid as Id<"users">);
          if (!result.ok) return [uid, null] as const;
          return [uid, getUserSportRoleLabel(result.data, selectedGame)] as const;
        }),
      );

      if (cancelled) return;

      setMemberSportRoleByUid((prev) => {
        const next = { ...prev };
        entries.forEach(([uid, label]) => {
          next[uid] = label;
        });
        return next;
      });
    };

    fetchRoles();

    return () => {
      cancelled = true;
    };
  }, [memberSportRoleByUid, resolvedTeam, selectedGame, userId, userProfile]);

  useEffect(() => {
    if ((!isCaptainForGame || !canUseCaptainBooking) && teamMode !== "solo") {
      resetTeamBookingState();
      return;
    }

    if (isCaptainForGame && canUseCaptainBooking && !selectedTeamId) {
      setSelectedTeamId(captainedTeams[0]?.id || null);
    }
  }, [
    canUseCaptainBooking,
    captainedTeams,
    isCaptainForGame,
    resetTeamBookingState,
    selectedTeamId,
    teamMode,
  ]);

  useEffect(() => {
    setSelectedTeamMemberUids([]);
  }, [selectedTeamId]);

  useEffect(() => {
    if (teamMode !== "team") return;
    if (!resolvedTeam) return;

    const limit = Math.max(0, reservedSlots - 1);
    if (limit === 0) {
      setSelectedTeamMemberUids([]);
      return;
    }

    setSelectedTeamMemberUids((prev) => {
      const available = selectableTeamMembers.map((member) => member.uid);
      const filtered = prev.filter((uid) => available.includes(uid));
      if (filtered.length >= limit) return filtered.slice(0, limit);

      const needed = limit - filtered.length;
      const additions = available
        .filter((uid) => !filtered.includes(uid))
        .slice(0, needed);
      return [...filtered, ...additions];
    });
  }, [reservedSlots, resolvedTeam, selectableTeamMembers, teamMode]);

  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeamDetails(null);
      return;
    }
    refreshSelectedTeam(selectedTeamId);
  }, [refreshSelectedTeam, selectedTeamId]);

  return {
    canUseCaptainBooking,
    captainedTeams,
    isCaptainForGame,
    memberSportRoleByUid,
    refreshSelectedTeam,
    reservedSlots,
    resolvedTeam,
    resetTeamBookingState,
    selectableTeamMembers,
    selectedTeamId,
    selectedTeamMemberUids,
    setBookingMode,
    setSelectedTeamId,
    setTeamPaymentMode,
    setReservedSlotsCount,
    teamMode,
    teamPaymentMode,
    toggleSelectedTeamMember,
  };
}
