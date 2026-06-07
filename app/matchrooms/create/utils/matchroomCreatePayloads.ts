import type { Id } from "../../../../convex/_generated/dataModel";
import type { Team } from "../../../../src/services/convex/teamService";
import type { UserProfile } from "../../../../src/services/userService";

type TeamMode = "solo" | "team";
type TeamPaymentMode = "captain_pays_all" | "captain_pays_self";
type LocationMode = "zone" | "broadcast";
type WalkInPaymentMode = "venue_pay" | "guest_pay";

type WalkInSeatPlayerDraft = {
  character?: string;
  favouriteClub?: string;
  formation?: string;
  name: string;
  seatNumber: number;
  skillTier: string;
};

type MatchroomCreateFormData = {
  battingOrder: string;
  battingStyle: string;
  bowlingOrder: string;
  bowlingStyle: string;
  composition: string;
  date: string;
  description: string;
  favouriteClub: string;
  format: string;
  maxPlayers: number;
  overs: string;
  playstyle: string;
  pricePerPlayer: number;
  rankRequirement: string;
  selectedMaps: string[];
  seriesType: string;
  sidePreference: string;
  skillLevel: string;
  tekkenCharacters: string[];
  time: string;
  title: string;
};

type AssignedTeamMember = {
  role: string;
  uid: string;
  username: string;
};

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

const sanitizeData = (data: Record<string, unknown>) => {
  const cleaned: Record<string, unknown> = {};
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== undefined) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

export function buildZoneWalkInPayload(params: {
  adminName: string;
  adminUid: string;
  branch: { id: string; label: string } | null;
  formData: MatchroomCreateFormData;
  gameKey: string;
  pricePerPlayer: number;
  seatCountInput: string;
  seriesType: "BO1" | "BO3" | "BO5";
  userId: string;
  userName: string;
  walkInPaymentMode: WalkInPaymentMode;
  walkInSeatPlayers: WalkInSeatPlayerDraft[];
  walkInSeed: number;
  walkInTeamACaptainSeatNumber: number | null;
  walkInTeamBCaptainSeatNumber: number | null;
  zoneId: string;
  zoneOwnerUid: string;
}): {
  adminName: string;
  adminUid: string;
  bookedSeatCount: number;
  branchId: string | null;
  branchName: string | null;
  captainSeatNumber: number | null;
  currency: "PKR";
  durationMinutes: number;
  gameKey: string;
  knownPlayers: Array<{
    isCaptain: boolean;
    seatNumber: number;
    skillTier: string;
    uid: string;
    username: string;
  }>;
  paymentMode: WalkInPaymentMode;
  pricePerPlayer: number;
  scheduledDate: string;
  scheduledTime: string;
  seatCount: number;
  seriesType: "BO1" | "BO3" | "BO5";
  title: string;
  zoneId: string;
  zoneOwnerUid: string;
} {
  const {
    adminName,
    adminUid,
    branch,
    formData,
    gameKey,
    pricePerPlayer,
    seatCountInput,
    seriesType,
    userId,
    walkInPaymentMode,
    walkInSeatPlayers,
    walkInSeed,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
    zoneId,
    zoneOwnerUid,
  } = params;

  const durationMinutes = (() => {
    if (isCsStyleGame(gameKey)) {
      if (seriesType === "BO1") return 60;
      if (seriesType === "BO3") return 180;
      return 300;
    }
    if (gameKey === "fc26") {
      if (seriesType === "BO1") return 30;
      if (seriesType === "BO3") return 60;
      return 120;
    }
    if (gameKey === "tekken8") {
      if (seriesType === "BO1") return 60;
      if (seriesType === "BO3") return 120;
      return 180;
    }
    if (gameKey === "indoor_cricket") {
      return formData.overs === "6" ? 150 : 120;
    }
    if (gameKey === "padel" || gameKey === "pickleball") {
      if (seriesType === "BO1") return 60;
      if (seriesType === "BO3") return 120;
      return 180;
    }
    return 60;
  })();

  const totalSeats = isCsStyleGame(gameKey)
    ? 10
    : Math.max(1, Number(formData.maxPlayers || 0));
  const parsedSeatCount = Number.parseInt(seatCountInput, 10);
  const bookedSeats = Number.isFinite(parsedSeatCount)
    ? Math.max(0, Math.min(totalSeats, Math.floor(parsedSeatCount)))
    : totalSeats;

  const validPlayers = walkInSeatPlayers
    .slice(0, bookedSeats)
    .filter((player) => player.name && player.name.trim().length > 0);

  const knownPlayers = validPlayers.map((player) => ({
    isCaptain:
      player.seatNumber === walkInTeamACaptainSeatNumber ||
      player.seatNumber === walkInTeamBCaptainSeatNumber,
    seatNumber: player.seatNumber,
    skillTier: player.skillTier,
    uid: `walkin_${userId}_${walkInSeed}_${player.seatNumber}`,
    username: player.name.trim(),
  }));

  return {
    adminName,
    adminUid,
    bookedSeatCount: knownPlayers.length,
    branchId: branch?.id || null,
    branchName: branch?.label || null,
    captainSeatNumber: walkInTeamACaptainSeatNumber,
    currency: "PKR",
    durationMinutes,
    gameKey,
    knownPlayers,
    paymentMode: walkInPaymentMode,
    pricePerPlayer,
    scheduledDate: formData.date,
    scheduledTime: formData.time,
    seatCount: totalSeats,
    seriesType,
    title: formData.title.trim() || "Walk-in Matchroom",
    zoneId,
    zoneOwnerUid,
  };
}

export function buildBookingRequestPayload(params: {
  amountDue: number;
  broadcastAreas: string[];
  duration: number;
  formData: MatchroomCreateFormData;
  gameKey: string;
  hostSkillAnswers: Record<string, unknown>;
  hostSkillScore: number | null;
  hostSkillTier: string | null;
  locationMode: LocationMode;
  paymentStatus: string;
  reservedSlots: number;
  seatsPaid: number;
  selectedTeamId: string | null;
  selectedZoneId: string | null;
  selectedZoneRateKey: string | null;
  selectedZoneRateResourceContext: {
    assetType: string;
    tier?: string;
    surface?: string;
  } | null;
  seriesType: string;
  teamMode: TeamMode;
  userId: string;
  userProfile: UserProfile;
}): Record<string, unknown> {
  const {
    amountDue,
    broadcastAreas,
    duration,
    formData,
    gameKey,
    hostSkillAnswers,
    hostSkillScore,
    hostSkillTier,
    locationMode,
    paymentStatus,
    reservedSlots,
    seatsPaid,
    selectedTeamId,
    selectedZoneId,
    selectedZoneRateKey,
    selectedZoneRateResourceContext,
    seriesType,
    teamMode,
    userId,
    userProfile,
  } = params;

  return {
    budgetPerPlayer: formData.pricePerPlayer || 0,
    currency: "PKR",
    description: formData.description?.trim() || "",
    durationHours: gameKey === "futsal" ? duration : null,
    flexibilityWindow: "Exact time",
    format: formData.format,
    gameKey,
    hostSkillContext: {
      answers: hostSkillAnswers || {},
      gameKey,
    },
    hostSkillScore: hostSkillScore ?? null,
    hostSkillTier: hostSkillTier ?? "Any",
    lifecycleStatus:
      locationMode === "zone" ? "zone_admin_pending" : undefined,
    locationMode,
    maxPlayers: formData.maxPlayers,
    overs: formData.overs || null,
    paymentAmount: amountDue,
    paymentReservedSlots: seatsPaid,
    paymentStatus,
    preferredAreas:
      locationMode === "broadcast" && broadcastAreas.length > 0
        ? broadcastAreas
        : userProfile.areasPreferred || [],
    preferredDate: formData.date ? new Date(formData.date).getTime() : undefined,
    preferredTime: formData.time || (undefined as never),
    reservedSlots: teamMode === "team" ? reservedSlots : 1,
    requestedResourceAssetType: selectedZoneRateResourceContext?.assetType || undefined,
    requestedResourceSurface: selectedZoneRateResourceContext?.surface || undefined,
    requestedResourceTier: selectedZoneRateResourceContext?.tier || undefined,
    selectedMaps: formData.selectedMaps || [],
    selectedZoneRateKey: selectedZoneRateKey || undefined,
    seriesType:
      isCsStyleGame(gameKey) || gameKey === "fc26" || gameKey === "tekken8"
        ? seriesType
        : gameKey === "padel" || gameKey === "pickleball"
          ? formData.seriesType || null
          : null,
    skillLevel: formData.skillLevel || "Any",
    teamId: teamMode === "team" ? selectedTeamId || null : null,
    teamMode,
    title: formData.title.trim(),
    userId,
    userName: userProfile.fullName || userProfile.username || "Player",
    zoneId:
      locationMode === "zone"
        ? (selectedZoneId as Id<"zones"> | undefined)
        : undefined,
  };
}

export function buildAssignedTeamMembers(params: {
  activeProfile: UserProfile;
  memberSportRoleByUid: Record<string, string | null>;
  reservedSlots: number;
  resolvedTeam: Team | null;
  selectableTeamMembers: Array<{ uid: string; username?: string }>;
  selectedTeamMemberUids: string[];
  teamMode: TeamMode;
}): AssignedTeamMember[] {
  const {
    activeProfile,
    memberSportRoleByUid,
    reservedSlots,
    resolvedTeam,
    selectableTeamMembers,
    selectedTeamMemberUids,
    teamMode,
  } = params;

  if (teamMode !== "team" || !resolvedTeam) return [];

  return [
    {
      role: memberSportRoleByUid[resolvedTeam.captainUid]
        ? `Captain - ${memberSportRoleByUid[resolvedTeam.captainUid]}`
        : "Captain",
      uid: resolvedTeam.captainUid,
      username:
        resolvedTeam.captainUsername ||
        activeProfile.username ||
        activeProfile.fullName ||
        "Captain",
    },
    ...selectedTeamMemberUids.map((uid) => {
      const member = selectableTeamMembers.find((entry) => entry.uid === uid);
      return {
        role: memberSportRoleByUid[uid] || "Player",
        uid,
        username: member?.username || "Team Member",
      };
    }),
  ].slice(0, reservedSlots);
}

export function buildMatchroomPayload(params: {
  activeProfile: UserProfile;
  amountDue: number;
  assignedTeamMembers: AssignedTeamMember[];
  branchId: string | null;
  broadcastAreas: string[];
  captainSeatNumber: number | null;
  clientCreateRequestId: string;
  duration: number;
  formData: MatchroomCreateFormData;
  gameKey: string;
  hostRole: string | null;
  hostSkillAnswers: Record<string, unknown>;
  hostSkillScore: number | null;
  hostSkillTier: string | null;
  locationMode: LocationMode;
  locationName: string | null;
  matchCode: string;
  paymentStatus: string;
  reservedSlots: number;
  seatsPaid: number;
  selectedTeamId: string | null;
  selectedTeamName: string | null;
  selectedZoneId: string | null;
  selectedZoneRateKey: string | null;
  selectedZoneRateResourceContext: {
    assetType: string;
    tier?: string;
    surface?: string;
  } | null;
  seriesType: string;
  teamMode: TeamMode;
  teamPaymentMode: TeamPaymentMode;
  walkIn: null | {
    branchId: string | null;
    bookedSeatCount: number;
    roster: WalkInSeatPlayerDraft[];
    seatCount: number;
  };
}): Record<string, unknown> {
  const {
    activeProfile,
    amountDue,
    assignedTeamMembers,
    branchId,
    broadcastAreas,
    captainSeatNumber,
    clientCreateRequestId,
    duration,
    formData,
    gameKey,
    hostRole,
    hostSkillAnswers,
    hostSkillScore,
    hostSkillTier,
    locationMode,
    locationName,
    matchCode,
    paymentStatus,
    reservedSlots,
    seatsPaid,
    selectedTeamId,
    selectedTeamName,
    selectedZoneId,
    selectedZoneRateKey,
    selectedZoneRateResourceContext,
    seriesType,
    teamMode,
    teamPaymentMode,
    walkIn,
  } = params;

  const durationMinutes = (() => {
    if (gameKey === "futsal") return 60;
    if (gameKey === "indoor_cricket") {
      if (formData.overs === "6") return 150;
      return 120;
    }
    if (isCsStyleGame(gameKey)) {
      if (seriesType === "BO1") return 60;
      if (seriesType === "BO3") return 180;
      if (seriesType === "BO5") return 300;
      if (seriesType === "BO10") return 600;
    }
    if (gameKey === "fc26") {
      if (seriesType === "BO1") return 30;
      if (seriesType === "BO3") return 60;
      if (seriesType === "BO5") return 120;
      if (seriesType === "BO10") return 180;
    }
    if (gameKey === "tekken8") {
      if (seriesType === "BO7") return 60;
      if (seriesType === "BO20") return 120;
      if (seriesType === "BO40") return 180;
    }
    if (gameKey === "padel" || gameKey === "pickleball") {
      if (formData.seriesType === "BO5") return 120;
      if (formData.seriesType === "BO10") return 180;
      return 60;
    }
    return 60;
  })();

  return sanitizeData({
    assignedTeamMembers,
    branchId: branchId || undefined,
    clientCreateRequestId: clientCreateRequestId || undefined,
    battingOrder:
      gameKey === "indoor_cricket" ? formData.battingOrder : null,
    battingStyle:
      gameKey === "indoor_cricket" ? formData.battingStyle : null,
    bookingSource: walkIn ? "walkin" : undefined,
    bowlingOrder:
      gameKey === "indoor_cricket" ? formData.bowlingOrder : null,
    bowlingStyle:
      gameKey === "indoor_cricket" ? formData.bowlingStyle : null,
    composition:
      gameKey === "indoor_cricket" ? formData.composition : null,
    description: formData.description?.trim() || "",
    durationHours: gameKey === "futsal" ? duration : null,
    durationMinutes,
    format: formData.format,
    game: gameKey,
    hostName: activeProfile.username || activeProfile.fullName || "Player",
    hostRole: hostRole || undefined,
    hostSkillContext: {
      answers: hostSkillAnswers || {},
      gameKey,
    },
    hostSkillScore: hostSkillScore ?? null,
    hostSkillTier: hostSkillTier ?? "Any",
    hostUid: activeProfile._id,
    isLocked: false,
    location:
      locationMode === "broadcast"
        ? undefined
        : locationName || "TBD",
    locationMode,
    broadcastAreas:
      locationMode === "broadcast" ? broadcastAreas : undefined,
    broadcastRequestStatus:
      locationMode === "broadcast" ? "waiting_for_fill" : undefined,
    matchCode,
    maxPlayers: isCsStyleGame(gameKey) ? 10 : formData.maxPlayers,
    overs: formData.overs || null,
    paymentAmount: amountDue,
    paymentCurrency: "PKR",
    paymentReservedSlots: seatsPaid,
    paymentStatus,
    playstyle: formData.playstyle || null,
    pricing: {
      currency: "PKR",
      perPlayer: formData.pricePerPlayer || 0,
    },
    rankRequirement: formData.rankRequirement || null,
    requiredRoles: [],
    reservedSlots: teamMode === "team" ? reservedSlots : 1,
    requestedResourceAssetType: selectedZoneRateResourceContext?.assetType || undefined,
    requestedResourceSurface: selectedZoneRateResourceContext?.surface || undefined,
    requestedResourceTier: selectedZoneRateResourceContext?.tier || undefined,
    scheduledDate: formData.date,
    scheduledTime: formData.time,
    selectedZoneRateKey: selectedZoneRateKey || undefined,
    selectedMaps: formData.selectedMaps || [],
    seriesType:
      isCsStyleGame(gameKey) || gameKey === "fc26" || gameKey === "tekken8"
        ? seriesType
        : gameKey === "padel" || gameKey === "pickleball"
          ? formData.seriesType || null
          : null,
    sidePreference: formData.sidePreference || null,
    skillLevel: hostSkillTier || formData.skillLevel || "Any",
    status: "open" as const,
    teamId: teamMode === "team" ? selectedTeamId || null : null,
    teamMode,
    teamName: teamMode === "team" ? selectedTeamName || null : null,
    teamPaymentMode: teamMode === "team" ? teamPaymentMode : undefined,
    tekkenCharacters: gameKey === "tekken8" ? formData.tekkenCharacters : undefined,
    title: formData.title.trim(),
    walkIn: walkIn
      ? {
          branchId: walkIn.branchId,
          bookedSeatCount: walkIn.bookedSeatCount,
          captainSeatNumber,
          roster: walkIn.roster,
          seatCount: walkIn.seatCount,
        }
      : null,
    zoneId: locationMode === "zone" ? selectedZoneId || undefined : undefined,
  });
}
