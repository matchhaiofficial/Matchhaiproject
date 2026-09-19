type TeamMode = "solo" | "team";
type LocationMode = "zone" | "broadcast";

type WalkInSeatPlayerDraft = {
  name: string;
};

export type MatchroomCreateValidationError = {
  message: string;
  reason: string;
  title: string;
};

export type MatchroomCreateValidationParams = {
  adminBranchesCount: number;
  broadcastAreasCount: number;
  canUseCaptainBooking: boolean;
  formData: {
    date: string;
    format: string;
    maxPlayers: number;
    time: string;
    title: string;
  };
  isCaptainForGame: boolean;
  isDateAllowed: boolean;
  isZoneWalkInAdmin: boolean;
  locationMode: LocationMode;
  minAllowedDateLabel: string;
  reservedSlots: number;
  selectedGame: string | null;
  selectedTeamId: string | null;
  selectedTeamMemberCount: number;
  selectedZoneId: string | null;
  selectedZoneRateKey: string | null;
  seriesType: string;
  teamMode: TeamMode;
  userAreaPreferenceCount: number;
  walkInBranchId: string | null;
  walkInSeatCount: string;
  walkInSeatPlayers: WalkInSeatPlayerDraft[];
  walkInTeamACaptainSeatNumber: number | null;
  walkInTeamBCaptainSeatNumber: number | null;
  zoneIdAvailableForWalkIn: boolean;
  zoneRateOptionsCount: number;
};

const WALKIN_SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

const getWalkInSeatMetrics = (
  walkInSeatCount: string,
  maxPlayers: number,
) => {
  const seatCount = Number.parseInt(walkInSeatCount, 10);
  const maxSeats = Math.max(1, Number(maxPlayers || 0));
  const normalizedBookedSeats = Number.isFinite(seatCount)
    ? Math.max(0, Math.min(maxSeats, Math.floor(seatCount)))
    : 0;

  return { maxSeats, normalizedBookedSeats, seatCount };
};

export function getMatchroomCreateValidationError(
  params: MatchroomCreateValidationParams,
): MatchroomCreateValidationError | null {
  const {
    adminBranchesCount,
    broadcastAreasCount,
    canUseCaptainBooking,
    formData,
    isCaptainForGame,
    isDateAllowed,
    isZoneWalkInAdmin,
    locationMode,
    minAllowedDateLabel,
    reservedSlots,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberCount,
    selectedZoneId,
    selectedZoneRateKey,
    seriesType,
    teamMode,
    userAreaPreferenceCount,
    walkInBranchId,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
    zoneIdAvailableForWalkIn,
    zoneRateOptionsCount,
  } = params;

  if (isZoneWalkInAdmin) {
    if (!zoneIdAvailableForWalkIn) {
      return {
        message: "Unable to resolve your venue. Please try again.",
        reason: "admin_zone_missing",
        title: "Zone Not Found",
      };
    }
    if (!selectedGame) {
      return {
        message: "Please select a game/sport",
        reason: "missing_game",
        title: "Missing Game",
      };
    }
    if (!formData.title?.trim()) {
      return {
        message: "Please enter a match title",
        reason: "missing_title",
        title: "Missing Title",
      };
    }
    if (!formData.date || !formData.time) {
      return {
        message: "Please enter date and time",
        reason: "missing_date_time",
        title: "Missing Date/Time",
      };
    }

    const { maxSeats, normalizedBookedSeats, seatCount } = getWalkInSeatMetrics(
      walkInSeatCount,
      formData.maxPlayers,
    );

    if (!Number.isFinite(seatCount) || seatCount < 0) {
      return {
        message: "Booked seats cannot be negative.",
        reason: "invalid_walkin_seat_count_negative",
        title: "Invalid Seats",
      };
    }
    if (seatCount === 0) {
      return {
        message: "Please enter how many walk-in players are available.",
        reason: "missing_walkin_player_count",
        title: "Missing Player Count",
      };
    }
    if (seatCount > maxSeats) {
      return {
        message: `Booked seats cannot exceed total seats (${maxSeats}).`,
        reason: "invalid_walkin_seat_count_exceeds",
        title: "Invalid Seats",
      };
    }

    if (normalizedBookedSeats > 0) {
      if (isCsStyleGame(selectedGame)) {
        const teamBSplitIndex = Math.ceil(normalizedBookedSeats / 2);
        const hasTeamAPlayers = walkInSeatPlayers
          .slice(0, teamBSplitIndex)
          .some((player) => player.name && player.name.trim().length > 0);
        const hasTeamBPlayers = walkInSeatPlayers
          .slice(teamBSplitIndex, normalizedBookedSeats)
          .some((player) => player.name && player.name.trim().length > 0);

        if (hasTeamAPlayers && !walkInTeamACaptainSeatNumber) {
          return {
            message: "Select Team A Captain",
            reason: "missing_cap_a",
            title: "Missing Captain",
          };
        }
        if (hasTeamBPlayers && !walkInTeamBCaptainSeatNumber) {
          return {
            message: "Select Team B Captain",
            reason: "missing_cap_b",
            title: "Missing Captain",
          };
        }
      } else {
        const hasAnyPlayers = walkInSeatPlayers
          .slice(0, normalizedBookedSeats)
          .some((player) => player.name && player.name.trim().length > 0);

        if (
          hasAnyPlayers &&
          !walkInTeamACaptainSeatNumber &&
          !walkInTeamBCaptainSeatNumber
        ) {
          return {
            message: "Please select at least one captain.",
            reason: "walkin_missing_captain",
            title: "Missing Captain",
          };
        }
      }
    }

    if (!WALKIN_SERIES_OPTIONS.includes(seriesType as (typeof WALKIN_SERIES_OPTIONS)[number])) {
      return {
        message: "Please select series type (BO1, BO3, or BO5).",
        reason: "invalid_walkin_series",
        title: "Missing Series",
      };
    }

    if (zoneRateOptionsCount > 0 && !selectedZoneRateKey) {
      return {
        message: "Please select a rate type to calculate price per player.",
        reason: "walkin_zone_rate_type_missing",
        title: "Missing Rate Type",
      };
    }

    if (adminBranchesCount > 1 && !walkInBranchId) {
      return {
        message: "Select a branch for this walk-in booking.",
        reason: "walkin_branch_missing",
        title: "Missing Branch",
      };
    }

    return null;
  }

  if (!selectedGame) {
    return {
      message: "Please select a game/sport",
      reason: "missing_game",
      title: "Missing Game",
    };
  }
  if (!formData.title?.trim()) {
    return {
      message: "Please enter a match title",
      reason: "missing_title",
      title: "Missing Title",
    };
  }
  if (!formData.maxPlayers || formData.maxPlayers < 2) {
    return {
      message: "Please enter a valid number of players (minimum 2)",
      reason: "invalid_max_players",
      title: "Invalid Players",
    };
  }
  if (!formData.format) {
    return {
      message: "Please select a match format",
      reason: "missing_format",
      title: "Missing Format",
    };
  }
  if (!formData.date || !formData.time) {
    return {
      message: "Please enter date and time",
      reason: "missing_date_time",
      title: "Missing Date/Time",
    };
  }
  if (!isDateAllowed) {
    const label = teamMode === "team" ? "captains" : "solo players";
    return {
      message: `Earliest allowed time for ${label} is ${minAllowedDateLabel}.`,
      reason: "invalid_date_lead_time",
      title: "Date Too Soon",
    };
  }
  if (teamMode === "team") {
    if (!isCaptainForGame) {
      return {
        message: "Only team captains can book multiple reserved slots.",
        reason: "team_mode_not_captain",
        title: "Not Authorized",
      };
    }
    if (!canUseCaptainBooking) {
      return {
        message: "Captain booking needs at least one additional player in your team.",
        reason: "team_mode_not_enough_players",
        title: "More Teammates Needed",
      };
    }
    if (!selectedTeamId) {
      return {
        message: "Please select your team.",
        reason: "team_mode_missing_team",
        title: "Missing Team",
      };
    }
    if (reservedSlots < 2 || reservedSlots > 5) {
      return {
        message: "Reserved slots must be between 2 and 5.",
        reason: "team_mode_invalid_reserved_slots",
        title: "Invalid Slots",
      };
    }
    const needed = Math.max(0, reservedSlots - 1);
    if (selectedTeamMemberCount !== needed) {
      return {
        message: `Please select ${needed} player${needed === 1 ? "" : "s"} from your team.`,
        reason: "team_mode_missing_players",
        title: "Select Players",
      };
    }
  }
  if (locationMode === "zone" && !selectedZoneId) {
    return {
      message: "Please select a zone to host the match",
      reason: "zone_missing",
      title: "Missing Zone",
    };
  }
  if (
    locationMode === "zone" &&
    selectedZoneId &&
    zoneRateOptionsCount > 0 &&
    !selectedZoneRateKey
  ) {
    return {
      message: "Please select a rate type to calculate price per player.",
      reason: "zone_rate_type_missing",
      title: "Missing Rate Type",
    };
  }
  if (
    locationMode === "broadcast" &&
    broadcastAreasCount === 0
  ) {
    return {
      message: userAreaPreferenceCount > 0
        ? "Select at least one preferred area to broadcast this matchroom."
        : "Please select at least one area to broadcast this matchroom.",
      reason: "broadcast_area_missing",
      title: "Missing Areas",
    };
  }

  return null;
}

export function getMatchroomCreateSubmitBlockers(
  params: MatchroomCreateValidationParams,
): string[] {
  const {
    adminBranchesCount,
    broadcastAreasCount,
    canUseCaptainBooking,
    formData,
    isDateAllowed,
    isZoneWalkInAdmin,
    locationMode,
    minAllowedDateLabel,
    reservedSlots,
    selectedGame,
    selectedTeamId,
    selectedTeamMemberCount,
    selectedZoneId,
    selectedZoneRateKey,
    seriesType,
    teamMode,
    userAreaPreferenceCount,
    walkInBranchId,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
    zoneRateOptionsCount,
  } = params;

  if (isZoneWalkInAdmin) {
    const blockers: string[] = [];
    if (!selectedGame) blockers.push("Select a game");
    if (!formData.title?.trim()) blockers.push("Enter match title");
    if (!formData.date || !formData.time) blockers.push("Pick date and time");

    const { maxSeats, normalizedBookedSeats, seatCount } = getWalkInSeatMetrics(
      walkInSeatCount,
      formData.maxPlayers,
    );

    if (!Number.isFinite(seatCount) || seatCount < 0) {
      blockers.push("Booked seats cannot be negative");
    }
    if (Number.isFinite(seatCount) && seatCount === 0) {
      blockers.push("Enter walk-in player count");
    }
    if (Number.isFinite(seatCount) && seatCount > maxSeats) {
      blockers.push(`Booked seats cannot exceed ${maxSeats}`);
    }

    if (normalizedBookedSeats > 0) {
      if (isCsStyleGame(selectedGame)) {
        const teamBSplitIndex = Math.ceil(normalizedBookedSeats / 2);
        const hasTeamAPlayers = walkInSeatPlayers
          .slice(0, teamBSplitIndex)
          .some((player) => player.name && player.name.trim().length > 0);
        const hasTeamBPlayers = walkInSeatPlayers
          .slice(teamBSplitIndex, normalizedBookedSeats)
          .some((player) => player.name && player.name.trim().length > 0);

        if (hasTeamAPlayers && !walkInTeamACaptainSeatNumber) {
          blockers.push("Select Team A captain");
        }
        if (hasTeamBPlayers && !walkInTeamBCaptainSeatNumber) {
          blockers.push("Select Team B captain");
        }
      } else {
        const hasAnyPlayers = walkInSeatPlayers
          .slice(0, normalizedBookedSeats)
          .some((player) => player.name && player.name.trim().length > 0);
        if (
          hasAnyPlayers &&
          !walkInTeamACaptainSeatNumber &&
          !walkInTeamBCaptainSeatNumber
        ) {
          blockers.push("Select captain");
        }
      }
    }

    if (!WALKIN_SERIES_OPTIONS.includes(seriesType as (typeof WALKIN_SERIES_OPTIONS)[number])) {
      blockers.push("Select series type");
    }
    if (zoneRateOptionsCount > 0 && !selectedZoneRateKey) {
      blockers.push("Select zone rate type");
    }
    if (adminBranchesCount > 1 && !walkInBranchId) {
      blockers.push("Select branch");
    }
    return blockers;
  }

  const blockers: string[] = [];
  if (!selectedGame) blockers.push("Select a game");
  if (!formData.title?.trim()) blockers.push("Enter match title");
  if (!formData.format) blockers.push("Select match format");
  if (!formData.date || !formData.time) blockers.push("Pick date and time");
  if (!isDateAllowed) {
    blockers.push(`Earliest allowed time is ${minAllowedDateLabel}`);
  }
  if (locationMode === "zone" && !selectedZoneId) {
    blockers.push("Select a zone/court");
  }
  if (
    locationMode === "zone" &&
    selectedZoneId &&
    zoneRateOptionsCount > 0 &&
    !selectedZoneRateKey
  ) {
    blockers.push("Select zone rate type");
  }
  if (teamMode === "team") {
    if (!canUseCaptainBooking) {
      blockers.push("Add at least one teammate to your team");
    }
    if (!selectedTeamId) blockers.push("Select your team");
    const needed = Math.max(0, reservedSlots - 1);
    if (selectedTeamMemberCount !== needed) {
      blockers.push(`Select ${needed} teammate${needed === 1 ? "" : "s"}`);
    }
  }
  if (
    locationMode === "broadcast" &&
    broadcastAreasCount === 0
  ) {
    blockers.push("Select at least one area");
  }
  return blockers;
}
