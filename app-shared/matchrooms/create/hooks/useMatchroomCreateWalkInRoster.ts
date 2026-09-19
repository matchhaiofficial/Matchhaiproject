import { useCallback, useEffect, useMemo, useState } from "react";

import type { SkillTier } from "../../../../src/services/skillRatingService";

export type WalkInSeatPlayerDraft = {
  seatNumber: number;
  name: string;
  skillTier: SkillTier | "";
  favouriteClub?: string;
  formation?: string;
  character?: string;
};

type Params = {
  isZoneWalkInAdmin: boolean;
  maxPlayers: number;
  selectedGame: string | null;
};

const DEFAULT_SEAT_COUNT = "0";
const DEFAULT_TEAM_A_CAPTAIN_SEAT = 1;
const DEFAULT_TEAM_B_CAPTAIN_SEAT = 6;

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

export function useMatchroomCreateWalkInRoster({
  isZoneWalkInAdmin,
  maxPlayers,
  selectedGame,
}: Params) {
  const [walkInSeatCount, setWalkInSeatCount] = useState(DEFAULT_SEAT_COUNT);
  const [walkInSeatPlayers, setWalkInSeatPlayers] = useState<
    WalkInSeatPlayerDraft[]
  >([]);
  const [walkInTeamACaptainSeatNumber, setWalkInTeamACaptainSeatNumber] =
    useState<number | null>(DEFAULT_TEAM_A_CAPTAIN_SEAT);
  const [walkInTeamBCaptainSeatNumber, setWalkInTeamBCaptainSeatNumber] =
    useState<number | null>(DEFAULT_TEAM_B_CAPTAIN_SEAT);

  const walkInBookedSeatCount = useMemo(() => {
    const parsed = Number.parseInt(walkInSeatCount, 10);
    const totalSeats = Math.max(1, Number(maxPlayers || 0));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.max(0, Math.min(totalSeats, Math.floor(parsed)));
  }, [maxPlayers, walkInSeatCount]);

  const walkInMaxSeatLimit = useMemo(
    () => Math.max(1, Number(maxPlayers || 0)),
    [maxPlayers],
  );

  const handleWalkInSeatCountChange = useCallback(
    (value: string) => {
      const digitsOnly = value.replace(/[^0-9]/g, "");
      if (!digitsOnly) {
        setWalkInSeatCount("");
        return;
      }

      const parsed = Number.parseInt(digitsOnly, 10);
      if (!Number.isFinite(parsed)) {
        setWalkInSeatCount("");
        return;
      }

      const clamped = Math.max(0, Math.min(walkInMaxSeatLimit, parsed));
      setWalkInSeatCount(String(clamped));
    },
    [walkInMaxSeatLimit],
  );

  const updateWalkInSeatPlayer = useCallback(
    (seatNumber: number, patch: Partial<WalkInSeatPlayerDraft>) => {
      setWalkInSeatPlayers((prev) =>
        prev.map((item) =>
          item.seatNumber === seatNumber ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const setWalkInCaptainSeat = useCallback(
    (team: "A" | "B", seatNumber: number) => {
      if (team === "A") {
        setWalkInTeamACaptainSeatNumber(seatNumber);
        return;
      }
      setWalkInTeamBCaptainSeatNumber(seatNumber);
    },
    [],
  );

  const resetWalkInRoster = useCallback((seatCount = DEFAULT_SEAT_COUNT) => {
    setWalkInSeatCount(seatCount);
    setWalkInTeamACaptainSeatNumber(DEFAULT_TEAM_A_CAPTAIN_SEAT);
    setWalkInTeamBCaptainSeatNumber(DEFAULT_TEAM_B_CAPTAIN_SEAT);
  }, []);

  useEffect(() => {
    if (!isZoneWalkInAdmin) return;

    const seats = Math.max(0, walkInBookedSeatCount);
    setWalkInSeatPlayers((prev) =>
      Array.from({ length: seats }, (_, idx) => {
        const existing = prev[idx];
        if (existing) {
          return { ...existing, seatNumber: idx + 1 };
        }
        return {
          seatNumber: idx + 1,
          name: "",
          skillTier: "",
        };
      }),
    );

    setWalkInTeamACaptainSeatNumber((prev) => {
      if (seats > 0 && (!prev || prev < 1 || prev > seats)) {
        return DEFAULT_TEAM_A_CAPTAIN_SEAT;
      }
      return prev;
    });

    setWalkInTeamBCaptainSeatNumber((prev) => {
      const teamBStart = isCsStyleGame(selectedGame)
        ? Math.ceil(seats / 2) + 1
        : Math.ceil(seats / 2) + 1;
      if (
        seats >= teamBStart &&
        (!prev || prev < teamBStart || prev > seats)
      ) {
        return teamBStart;
      }
      return prev;
    });
  }, [isZoneWalkInAdmin, walkInBookedSeatCount, selectedGame]);

  useEffect(() => {
    if (!isZoneWalkInAdmin) return;

    setWalkInSeatCount((prev) => {
      const parsed = Number.parseInt(prev, 10);
      if (!Number.isFinite(parsed)) return prev;
      const clamped = Math.max(
        0,
        Math.min(walkInMaxSeatLimit, Math.floor(parsed)),
      );
      return clamped === parsed ? prev : String(clamped);
    });
  }, [isZoneWalkInAdmin, walkInMaxSeatLimit]);

  return {
    handleWalkInSeatCountChange,
    resetWalkInRoster,
    setWalkInCaptainSeat,
    updateWalkInSeatPlayer,
    walkInBookedSeatCount,
    walkInMaxSeatLimit,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
  };
}
