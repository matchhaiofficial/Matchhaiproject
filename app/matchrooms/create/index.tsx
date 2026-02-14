import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import type { BookingRequest } from "../../../src/services/bookingRequestService";
import { createBookingRequest } from "../../../src/services/bookingRequestService";
import { createMatchroom } from "../../../src/services/matchService";
import {
  applyPricingRulesToRate,
  getEnabledPricingRulesForZone,
  type PricingRule,
} from "../../../src/services/pricingRuleService";
import { SkillTier } from "../../../src/services/skillRatingService";
import type { Team } from "../../../src/services/teamService";
import {
  getTeamById,
  getUserTeamsForGame,
} from "../../../src/services/teamService";
import type { UserProfile } from "../../../src/services/userService";
import {
  getUserProfile,
  getUserSportRoleLabel,
} from "../../../src/services/userService";
import { createZoneWalkInMatchroom } from "../../../src/services/zoneAdminBookingService";
import type { Zone } from "../../../src/services/zoneService";
import { COLORS, FONTS } from "../../../src/theme";

import Logger from "../../../src/utils/logger";
import BasicFields from "./components/BasicFields";
import BroadcastAreaSelector from "./components/BroadcastAreaSelector";
import GameDynamicFields from "./components/GameDynamicFields";
import GameSelector from "./components/GameSelector";
import LocationModeSelector from "./components/LocationModeSelector";
import RoleAutoFill from "./components/RoleAutoFill";
import SkillBracketSection from "./components/SkillBracketSection";
// import TeamModeSelector from './components/TeamModeSelector';
// import TeamPicker from './components/TeamPicker';
// import SlotReservation from './components/SlotReservation';
import ZonePicker from "./components/ZonePicker";
import styles from "./create.styles";

const generateMatchCode = (zoneName?: string | null) => {
  const prefix = zoneName
    ? zoneName
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase()
    : "MH";
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${random}`;
};

const ZONE_GAME_SUPPORT_MAP: Array<{ gameKey: string; flags: string[] }> = [
  { gameKey: "cs2", flags: ["supportsCs2"] },
  { gameKey: "fc26", flags: ["supportsFc25", "supportsFc26"] },
  { gameKey: "tekken8", flags: ["supportsTekken8"] },
  { gameKey: "futsal", flags: ["supportsFutsal"] },
  { gameKey: "indoor_cricket", flags: ["supportsIndoorCricket"] },
  { gameKey: "padel", flags: ["supportsPadel"] },
  { gameKey: "pickleball", flags: ["supportsPickleball"] },
];

const getSupportedGameKeysFromZoneGames = (zoneGames: any): string[] => {
  if (!zoneGames || typeof zoneGames !== "object") return [];
  return ZONE_GAME_SUPPORT_MAP.filter(({ flags }) =>
    flags.some((flag) => zoneGames?.[flag] === true),
  ).map(({ gameKey }) => gameKey);
};

const WALKIN_SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;
type WalkInSeriesType = (typeof WALKIN_SERIES_OPTIONS)[number];
const WALKIN_SKILL_TIER_OPTIONS: SkillTier[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Pro",
  "Elite",
];

type WalkInSeatPlayerDraft = {
  seatNumber: number;
  name: string;
  skillTier: SkillTier;
  favouriteClub?: string;
  formation?: string;
  character?: string;
};

const getWalkInDurationMinutes = (
  gameKey: string | null,
  series: WalkInSeriesType,
  overs?: string,
) => {
  if (gameKey === "cs2") {
    if (series === "BO1") return 60;
    if (series === "BO3") return 180;
    return 300;
  }
  if (gameKey === "fc26") {
    if (series === "BO1") return 30;
    if (series === "BO3") return 60;
    return 120;
  }
  if (gameKey === "tekken8") {
    if (series === "BO1") return 60;
    if (series === "BO3") return 120;
    return 180;
  }
  if (gameKey === "futsal") {
    if (series === "BO1") return 60;
    if (series === "BO3") return 90;
    return 120;
  }
  if (gameKey === "padel" || gameKey === "pickleball") {
    if (series === "BO1") return 60;
    if (series === "BO3") return 120;
    return 180;
  }
  if (gameKey === "indoor_cricket") {
    return overs === "6" ? 150 : 120;
  }
  if (series === "BO1") return 60;
  if (series === "BO3") return 120;
  return 180;
};

export default function CreateMatchroom() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { zone: adminZone } = useZoneData();
  const params = useLocalSearchParams<{
    zoneId?: string;
    zoneName?: string;
    zoneSupportedGames?: string;
    mode?: string;
    branchId?: string;
  }>();
  const isZoneWalkInAdmin = params.mode === "zone_walkin_admin";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hostRole, setHostRole] = useState<string | null>(null);

  // Skill System State
  const [hostSkillScore, setHostSkillScore] = useState<number | null>(null);
  const [hostSkillTier, setHostSkillTier] = useState<SkillTier | null>(null);
  const [hostSkillAnswers, setHostSkillAnswers] = useState<Record<string, any>>(
    {},
  );

  // Phase 2: Team State
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMode, setTeamMode] = useState<"solo" | "team">("solo");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [reservedSlots, setReservedSlots] = useState(1);
  const [selectedTeamMemberUids, setSelectedTeamMemberUids] = useState<
    string[]
  >([]);
  const [teamPaymentMode, setTeamPaymentMode] = useState<
    "captain_pays_all" | "captain_pays_self"
  >("captain_pays_all");
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<Team | null>(
    null,
  );
  const [memberSportRoleByUid, setMemberSportRoleByUid] = useState<
    Record<string, string | null>
  >({});

  // Phase 3: Location Mode State
  const [locationMode, setLocationMode] = useState<"zone" | "broadcast">(
    "zone",
  );
  const [broadcastAreas, setBroadcastAreas] = useState<string[]>([]);

  // Phase 3: Zone Selection State (pre-fill from params if coming from venue)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    params.zoneId || null,
  );
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(
    params.zoneName || null,
  );
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zonePricingRules, setZonePricingRules] = useState<PricingRule[]>([]);

  // Phase 4: CS2 & FC25/26 Specific State
  const [zoneRate, setZoneRate] = useState<number>(0);
  const [zoneRateOptions, setZoneRateOptions] = useState<
    Array<{ key: string; label: string; price: number }>
  >([]);
  const [selectedZoneRateKey, setSelectedZoneRateKey] = useState<string | null>(
    null,
  );
  const [seriesType, setSeriesType] = useState<
    "BO1" | "BO3" | "BO5" | "BO10" | "BO7" | "BO20" | "BO40"
  >("BO1");
  const [duration, setDuration] = useState<number>(1); // Duration in hours (for Futsal)
  const [walkInSeatCount, setWalkInSeatCount] = useState("10");
  const [walkInPaymentMode, setWalkInPaymentMode] = useState<
    "venue_pay" | "guest_pay"
  >("venue_pay");
  const [walkInBranchId, setWalkInBranchId] = useState<string | null>(
    typeof params.branchId === "string" && params.branchId.trim().length
      ? params.branchId
      : null,
  );
  const [walkInSeatPlayers, setWalkInSeatPlayers] = useState<
    WalkInSeatPlayerDraft[]
  >([]);
  const [walkInCaptainSeatNumber, setWalkInCaptainSeatNumber] = useState<
    number | null
  >(1);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    maxPlayers: 10,
    pricePerPlayer: 0,
    format: "",
    selectedMaps: [] as string[],
    skillLevel: "Any",
    playstyle: "",
    rankRequirement: "",
    overs: "",
    sidePreference: "",
    locationMode: "zone" as "zone" | "broadcast",
    date: "",
    time: "",
    favouriteClub: "",
    formation: "",
    tekkenCharacters: [] as string[],
    composition: "",
    battingOrder: "",
    battingStyle: "",
    bowlingStyle: "",
    bowlingOrder: "",
    seriesType: "",
  });

  // Phase 4: Calculate price per player for CS2 & FC25/26 & Futsal matches
  useEffect(() => {
    if (selectedGame === "cs2" && zoneRate > 0) {
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 3,
        BO5: 5,
        BO10: 10,
      };
      const hours = hoursMap[seriesType] || 1;

      // Price per player is simply the zone rate * hours (assuming rate is per PC/player)
      const pricePerPlayer = zoneRate * hours;
      setFormData((prev) => ({ ...prev, pricePerPlayer }));
    } else if (selectedGame === "fc26" && zoneRate > 0) {
      // FC Logic: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
      const hoursMap: Record<string, number> = {
        BO1: 0.5,
        BO3: 1,
        BO5: 2,
        BO10: 3,
      };
      const hours = hoursMap[seriesType] || 1;

      // Calculate Total Cost for the console/setup
      const totalConsoleCost = zoneRate * hours;

      // Calculate Price Per Player based on Format
      let pricePerPlayer = 0;
      if (formData.format === "1v1") {
        // 1v1 = 2 players sharing the cost (or paying for their share of the console time)
        // Assuming zoneRate is per console.
        pricePerPlayer = totalConsoleCost / 2;
      } else if (formData.format === "2v2") {
        // 2v2 = 4 players.
        pricePerPlayer = totalConsoleCost / 4;
      } else {
        // Fallback if format not selected yet, assume 1v1
        pricePerPlayer = totalConsoleCost / 2;
      }

      setFormData((prev) => ({ ...prev, pricePerPlayer }));
    } else if (selectedGame === "tekken8" && zoneRate > 0) {
      // Tekken 8 Logic:
      // Player flow: BO7 = 1hr, BO20 = 2hr, BO40 = 3hr
      // Admin walk-in flow: BO1 = 1hr, BO3 = 2hr, BO5 = 3hr
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO7: 1,
        BO20: 2,
        BO40: 3,
      };
      const hours = hoursMap[seriesType] || 1;

      // Calculate Total Cost for the console/setup
      const totalConsoleCost = zoneRate * hours;

      // Calculate Price Per Player based on Format
      let pricePerPlayer = 0;
      if (formData.format === "1v1") {
        pricePerPlayer = totalConsoleCost / 2;
      } else if (formData.format === "2v2") {
        pricePerPlayer = totalConsoleCost / 4;
      } else {
        pricePerPlayer = totalConsoleCost / 2;
      }

      setFormData((prev) => ({ ...prev, pricePerPlayer }));
    } else if (selectedGame === "futsal" && zoneRate > 0) {
      // Futsal Logic: Price is per hour for the court.
      // Total Cost = Hourly Rate * Duration
      // Price Per Player = Total Cost / Max Players

      const totalCourtCost = zoneRate * duration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;

      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      })); // Round up to nearest integer
    } else if (selectedGame === "indoor_cricket" && zoneRate > 0) {
      // Indoor Cricket Logic:
      // 5 overs (BO3) = 2 hours
      // 6 overs (BO3) = 2.5 hours
      // Price = (Hourly Rate * Duration) / 16 players

      let calcDuration = 2; // Default 2 hours for 5 overs
      if (formData.overs === "6") {
        calcDuration = 2.5;
      }

      const totalCourtCost = zoneRate * calcDuration;
      const pricePerPlayer =
        formData.maxPlayers > 0 ? totalCourtCost / formData.maxPlayers : 0;

      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      }));
    } else if (selectedGame === "padel" && zoneRate > 0) {
      // Padel Logic:
      // Player flow: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
      // Admin walk-in flow: BO1 = 1hr, BO3 = 2hr, BO5 = 3hr
      const seriesKey = isZoneWalkInAdmin ? seriesType : formData.seriesType;
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO10: 3,
      };
      const hours = hoursMap[seriesKey || ""] || 1;

      const totalCourtCost = zoneRate * hours;
      const pricePerPlayer = totalCourtCost / 4;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      }));
    } else if (selectedGame === "pickleball" && zoneRate > 0) {
      // Pickleball Logic:
      // Player flow: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
      // Admin walk-in flow: BO1 = 1hr, BO3 = 2hr, BO5 = 3hr
      const seriesKey = isZoneWalkInAdmin ? seriesType : formData.seriesType;
      const hoursMap: Record<string, number> = {
        BO1: 1,
        BO3: 2,
        BO5: 3,
        BO10: 3,
      };
      const hours = hoursMap[seriesKey || ""] || 1;

      const totalCourtCost = zoneRate * hours;
      const players = formData.format === "2v2" ? 4 : 2;
      const pricePerPlayer = totalCourtCost / players;
      setFormData((prev) => ({
        ...prev,
        pricePerPlayer: Math.ceil(pricePerPlayer),
      }));
    }
  }, [
    selectedGame,
    zoneRate,
    seriesType,
    formData.format,
    duration,
    formData.maxPlayers,
    formData.overs,
    formData.seriesType,
    isZoneWalkInAdmin,
  ]);

  // Sync walkInSeatCount with format for FC26/Tekken
  useEffect(() => {
    if (selectedGame === 'fc26' || selectedGame === 'tekken8') {
      let targetSeats = 0;
      if (formData.format === '1v1') {
        targetSeats = 2;
        setWalkInSeatCount('2');
      } else if (formData.format === '2v2') {
        targetSeats = 4;
        setWalkInSeatCount('4');
      }

      if (targetSeats > 0) {
        setWalkInSeatPlayers((prev) => {
          if (prev.length === targetSeats) return prev;
          const newPlayers = [...prev];
          if (newPlayers.length < targetSeats) {
            // Add missing slots
            for (let i = newPlayers.length; i < targetSeats; i++) {
              newPlayers.push({
                seatNumber: i + 1,
                name: '',
                skillTier: 'Beginner',
                favouriteClub: '',
                formation: '',
                character: '',
              });
            }
          } else {
            // Trim excess slots
            newPlayers.splice(targetSeats);
          }
          return newPlayers;
        });
      }
    }
  }, [selectedGame, formData.format]);

  const captainedTeams = useMemo(() => {
    if (!user?.uid) return [];
    return (teams || []).filter((t) => t.captainUid === user.uid);
  }, [teams, user?.uid]);

  const isCaptainForGame = captainedTeams.length > 0;

  const selectedTeam = useMemo(() => {
    if (!selectedTeamId) return null;
    return (teams || []).find((t) => t.id === selectedTeamId) || null;
  }, [teams, selectedTeamId]);

  const resolvedTeam = selectedTeamDetails || selectedTeam;

  const adminBranches = useMemo(() => {
    if (!adminZone) return [];

    const mapped = new Map<
      string,
      { id: string; label: string; games?: Record<string, boolean> | null }
    >();
    const upsert = (candidate: any) => {
      const id = String(candidate?.id || candidate?.branchId || "").trim();
      if (!id) return;
      const label = String(
        candidate?.branchDisplayName ||
        candidate?.name ||
        candidate?.areaLabel ||
        "Branch",
      ).trim();
      const existing = mapped.get(id);
      if (!existing) {
        mapped.set(id, { id, label, games: candidate?.games || null });
        return;
      }
      mapped.set(id, {
        id,
        label: existing.label || label,
        games: existing.games || candidate?.games || null,
      });
    };

    upsert(adminZone.primaryBranch);
    (Array.isArray(adminZone.branches) ? adminZone.branches : []).forEach(
      upsert,
    );

    return Array.from(mapped.values());
  }, [adminZone]);

  const selectedAdminBranch = useMemo(() => {
    if (!walkInBranchId) return null;
    return adminBranches.find((branch) => branch.id === walkInBranchId) || null;
  }, [adminBranches, walkInBranchId]);

  const walkInSupportedGameKeys = useMemo(() => {
    const byBranch = getSupportedGameKeysFromZoneGames(
      selectedAdminBranch?.games,
    );
    const byZone = getSupportedGameKeysFromZoneGames(adminZone?.games);
    // Return unique games from both sources to prevent auto-deselect
    return Array.from(new Set([...byBranch, ...byZone]));
  }, [adminZone?.games, selectedAdminBranch?.games]);

  const walkInBookedSeatCount = useMemo(() => {
    const parsed = Number.parseInt(walkInSeatCount, 10);
    const totalSeats = Math.max(1, Number(formData.maxPlayers || 0));
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.max(0, Math.min(totalSeats, Math.floor(parsed)));
  }, [formData.maxPlayers, walkInSeatCount]);

  const walkInMaxSeatLimit = useMemo(
    () => Math.max(1, Number(formData.maxPlayers || 0)),
    [formData.maxPlayers],
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

  const selectableTeamMembers = useMemo(() => {
    if (!resolvedTeam) return [];
    const members = Array.isArray(resolvedTeam.members)
      ? resolvedTeam.members
      : [];
    const memberUids = Array.isArray(resolvedTeam.memberUids)
      ? resolvedTeam.memberUids
      : [];

    const membersByUid = new Map<string, any>();
    members.forEach((m) => {
      if (m?.uid) membersByUid.set(m.uid, m);
    });

    // Prefer explicit memberUids ordering, but fall back to whatever we have.
    const uids =
      memberUids.length > 0 ? memberUids : Array.from(membersByUid.keys());

    return uids
      .filter((uid) => !!uid && uid !== resolvedTeam.captainUid)
      .map((uid) => {
        const existing = membersByUid.get(uid);
        if (existing) return existing;
        return {
          uid,
          username: uid.slice(0, 6) + "â€¦",
          role: "member" as const,
          joinedAt: null,
        };
      });
  }, [resolvedTeam]);

  useEffect(() => {
    setMemberSportRoleByUid({});
  }, [selectedGame]);

  useEffect(() => {
    if (!resolvedTeam || !selectedGame) return;

    const memberUids = Array.from(
      new Set(
        [
          resolvedTeam.captainUid,
          ...(resolvedTeam.members || []).map((m) => m.uid),
        ].filter(Boolean),
      ),
    );

    const missingUids = memberUids.filter(
      (uid) => !(uid in memberSportRoleByUid),
    );
    if (missingUids.length === 0) return;

    let cancelled = false;

    const fetchRoles = async () => {
      const entries = await Promise.all(
        missingUids.map(async (uid) => {
          if (uid === user?.uid && userProfile) {
            return [
              uid,
              getUserSportRoleLabel(userProfile, selectedGame),
            ] as const;
          }

          const res = await getUserProfile(uid);
          if (!res.ok) return [uid, null] as const;
          return [uid, getUserSportRoleLabel(res.data, selectedGame)] as const;
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
  }, [
    resolvedTeam,
    selectedGame,
    memberSportRoleByUid,
    user?.uid,
    userProfile,
  ]);

  useEffect(() => {
    if (!isCaptainForGame && teamMode !== "solo") {
      setTeamMode("solo");
      setSelectedTeamId(null);
      setReservedSlots(1);
      setSelectedTeamMemberUids([]);
    }

    if (isCaptainForGame && !selectedTeamId) {
      setSelectedTeamId(captainedTeams[0]?.id || null);
    }
  }, [isCaptainForGame, teamMode, selectedTeamId, captainedTeams]);

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
      const current = [...prev];
      const available = selectableTeamMembers.map((m) => m.uid);
      const filtered = current.filter((uid) => available.includes(uid));
      if (filtered.length >= limit) return filtered.slice(0, limit);
      const needed = limit - filtered.length;
      const toAdd = available
        .filter((uid) => !filtered.includes(uid))
        .slice(0, needed);
      return [...filtered, ...toAdd];
    });
  }, [teamMode, reservedSlots, selectableTeamMembers, resolvedTeam]);

  const refreshSelectedTeam = useCallback(async (teamId: string) => {
    const res = await getTeamById(teamId);
    if (res.ok && res.data) {
      setSelectedTeamDetails(res.data);
      setTeams((prev) => prev.map((t) => (t.id === teamId ? res.data! : t)));
    }
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setSelectedTeamDetails(null);
      return;
    }
    refreshSelectedTeam(selectedTeamId);
  }, [selectedTeamId, refreshSelectedTeam]);

  useEffect(() => {
    if (!isZoneWalkInAdmin) return;
    if (!adminZone?.id) return;

    setLocationMode("zone");
    setSelectedZoneId(adminZone.id);
    setSelectedZoneName(adminZone.venueBrandName || null);
    setSelectedZone(adminZone as Zone);
  }, [adminZone, isZoneWalkInAdmin]);

  useEffect(() => {
    if (!isZoneWalkInAdmin) return;
    if (adminBranches.length === 0) {
      setWalkInBranchId(null);
      return;
    }

    const explicitParamBranch =
      typeof params.branchId === "string" ? params.branchId.trim() : "";
    if (
      explicitParamBranch &&
      adminBranches.some((branch) => branch.id === explicitParamBranch)
    ) {
      setWalkInBranchId(explicitParamBranch);
      return;
    }

    if (adminBranches.length === 1) {
      setWalkInBranchId(adminBranches[0].id);
    } else if (
      walkInBranchId &&
      !adminBranches.some((branch) => branch.id === walkInBranchId)
    ) {
      setWalkInBranchId(null);
    }
  }, [adminBranches, isZoneWalkInAdmin, params.branchId, walkInBranchId]);

  useEffect(() => {
    if (!isZoneWalkInAdmin) return;
    const walkInSeries = WALKIN_SERIES_OPTIONS.includes(
      seriesType as WalkInSeriesType,
    )
      ? (seriesType as WalkInSeriesType)
      : "BO1";
    if (seriesType !== walkInSeries) {
      setSeriesType(walkInSeries);
      return;
    }

    const nextDurationHours =
      walkInSeries === "BO1" ? 1 : walkInSeries === "BO3" ? 1.5 : 2;
    setDuration((prev) =>
      prev === nextDurationHours ? prev : nextDurationHours,
    );
    setFormData((prev) => {
      const nextSeries = walkInSeries;
      if (prev.seriesType === nextSeries) return prev;
      return { ...prev, seriesType: nextSeries };
    });
  }, [isZoneWalkInAdmin, seriesType]);

  useEffect(() => {
    if (!isZoneWalkInAdmin || !selectedGame) return;
    setSeriesType("BO1");
  }, [isZoneWalkInAdmin, selectedGame]);

  //   useEffect(() => {
  //     if (!isZoneWalkInAdmin || !selectedGame) return;
  //     if (!walkInSupportedGameKeys.length) return;
  //     if (walkInSupportedGameKeys.includes(selectedGame)) return;
  //     setSelectedGame(null);
  //   }, [isZoneWalkInAdmin, selectedGame, walkInSupportedGameKeys]);

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
          skillTier: "Beginner",
        };
      }),
    );
    setWalkInCaptainSeatNumber((prev) => {
      if (seats <= 0) return null;
      if (prev && prev >= 1 && prev <= seats) return prev;
      return 1;
    });
  }, [isZoneWalkInAdmin, walkInBookedSeatCount]);

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

  useFocusEffect(
    useCallback(() => {
      if (selectedTeamId) {
        refreshSelectedTeam(selectedTeamId);
      }
    }, [selectedTeamId, refreshSelectedTeam]),
  );

  const minLeadDays = isZoneWalkInAdmin ? 0 : teamMode === "team" ? 2 : 3;
  const minAllowedDate = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + minLeadDays);
    return d;
  })();

  const isDateAllowed = (() => {
    if (!formData.date) return false;
    const dateObj = new Date(`${formData.date}T00:00`);
    if (isNaN(dateObj.getTime())) return false;
    return dateObj.getTime() >= minAllowedDate.getTime();
  })();

  useEffect(() => {
    if (isZoneWalkInAdmin) return;
    if (!formData.date) return;
    if (!isDateAllowed) {
      setFormData((prev) => ({ ...prev, date: "" }));
    }
  }, [isZoneWalkInAdmin, teamMode]);

  useEffect(() => {
    let cancelled = false;

    const loadPricingRules = async () => {
      if (!selectedZoneId) {
        setZonePricingRules([]);
        return;
      }

      const rules = await getEnabledPricingRulesForZone(selectedZoneId);
      if (!cancelled) {
        setZonePricingRules(rules);
      }
    };

    loadPricingRules();
    return () => {
      cancelled = true;
    };
  }, [selectedZoneId]);

  useEffect(() => {
    if (!selectedZone || !selectedGame) {
      setZoneRateOptions([]);
      setSelectedZoneRateKey(null);
      setZoneRate(0);
      return;
    }

    const pricing: any =
      selectedZone.pricing ||
      (selectedZone.branches?.[0] as any)?.pricing ||
      {};
    const options: Array<{ key: string; label: string; price: number }> = [];
    const branchId = selectedZone.branches?.[0]?.id || null;

    const formatLabel = formData.format === "2v2" ? "2v2" : "1v1";
    const priceKey = formData.format === "2v2" ? "price2v2" : "price1v1";
    const otherPriceKey = priceKey === "price1v1" ? "price2v2" : "price1v1";

    const addOption = (
      key: string,
      label: string,
      price: number | undefined,
      context: { assetType: any; tier?: string; surface?: string },
    ) => {
      if (typeof price !== "number" || price <= 0) return;

      const resolved = applyPricingRulesToRate(price, zonePricingRules, {
        at: new Date(),
        assetType: context.assetType,
        branchId,
        tier: context.tier || null,
        surface: context.surface || null,
      });

      const hasPromo = Boolean(resolved.appliedRule);
      options.push({
        key,
        label: hasPromo
          ? `${label} - PKR ${resolved.rate}/hr - Promo`
          : `${label} - PKR ${resolved.rate}/hr`,
        price: resolved.rate,
      });
    };

    if (selectedGame === "cs2") {
      const pc = pricing.pc || {};
      addOption("pc:regular", "Regular", pc?.regular?.price, {
        assetType: "pc",
        tier: "regular",
      });
      addOption("pc:premium", "Premium", pc?.premium?.price, {
        assetType: "pc",
        tier: "premium",
      });
      addOption("pc:elite", "Elite", pc?.elite?.price, {
        assetType: "pc",
        tier: "elite",
      });
    } else if (selectedGame === "fc26" || selectedGame === "tekken8") {
      const console = pricing.console || {};
      const ps5 = console.ps5 || {};
      const xbox = console.xbox || {};
      const ps5Price = (ps5?.[priceKey] || ps5?.[otherPriceKey]) as
        | number
        | undefined;
      const xboxPrice = (xbox?.[priceKey] || xbox?.[otherPriceKey]) as
        | number
        | undefined;
      addOption("console:ps5", `PS5 (${formatLabel})`, ps5Price, {
        assetType: "console",
        tier: "ps5",
      });
      addOption("console:xbox", `Xbox (${formatLabel})`, xboxPrice, {
        assetType: "console",
        tier: "xbox",
      });
    } else if (selectedGame === "futsal") {
      Object.entries(pricing.futsal || {}).forEach(([key, val]: any) => {
        const label = String(key).replace(/[-_]/g, " ");
        addOption(`futsal:${key}`, label, val?.price, {
          assetType: "futsal",
          surface: key,
        });
      });
    } else if (selectedGame === "indoor_cricket") {
      const cricket = pricing.indoorCricket || pricing.indoor_cricket || {};
      Object.entries(cricket || {}).forEach(([key, val]: any) => {
        const label = String(key).replace(/[-_]/g, " ");
        addOption(`cricket:${key}`, label, val?.price, {
          assetType: "indoor_cricket",
          surface: key,
        });
      });
    } else if (selectedGame === "padel") {
      Object.entries(pricing.padel || {}).forEach(([key, val]: any) => {
        const label = String(key).replace(/[-_]/g, " ");
        addOption(`padel:${key}`, label, val?.price, {
          assetType: "padel",
          surface: key,
        });
      });
    } else if (selectedGame === "pickleball") {
      Object.entries(pricing.pickleball || {}).forEach(([key, val]: any) => {
        const label = String(key).replace(/[-_]/g, " ");
        addOption(`pickleball:${key}`, label, val?.price, {
          assetType: "pickleball",
          surface: key,
        });
      });
    }

    setZoneRateOptions(options);
    if (options.length === 0) {
      setSelectedZoneRateKey(null);
      setZoneRate(0);
      return;
    }

    if (selectedZoneRateKey) {
      const match = options.find((opt) => opt.key === selectedZoneRateKey);
      if (match) {
        setZoneRate(match.price);
        return;
      }
    }

    if (options.length === 1) {
      setSelectedZoneRateKey(options[0].key);
      setZoneRate(options[0].price);
      return;
    }

    setSelectedZoneRateKey(null);
    setZoneRate(0);
  }, [
    selectedZone,
    selectedGame,
    formData.format,
    selectedZoneRateKey,
    zonePricingRules,
  ]);

  // Format-specific defaults are now applied in handleFieldChange to avoid duplicated effects

  useEffect(() => {
    if (isZoneWalkInAdmin) {
      setLoading(false);
      return;
    }
    loadUserProfile();
  }, [isZoneWalkInAdmin, user]);

  // Reset skill state when game changes
  useEffect(() => {
    setHostSkillScore(null);
    setHostSkillTier(null);
    setHostSkillAnswers({});
  }, [selectedGame]);

  // Check if user has games configured that match the venue's offerings
  useEffect(() => {
    if (isZoneWalkInAdmin) return;
    if (!userProfile || !params.zoneSupportedGames) return;

    try {
      const zoneSupportedGames: string[] = JSON.parse(
        params.zoneSupportedGames,
      );
      if (zoneSupportedGames.length === 0) return;

      // Game labels for display
      const gameLabels: Record<string, string> = {
        cs2: "CS2",
        fc26: "FC26",
        tekken8: "Tekken 8",
        futsal: "Futsal",
        indoor_cricket: "Indoor Cricket",
        padel: "Padel",
        pickleball: "Pickleball",
      };

      // Map game keys to profile flags
      const gameToProfileFlag: Record<string, keyof typeof userProfile> = {
        cs2: "playsCs2",
        fc26: "playsFc",
        tekken8: "playsTekken",
        futsal: "playsFutsal",
        indoor_cricket: "playsIndoorCricket",
        padel: "playsPadel",
        pickleball: "playsPickleball",
      };

      // Get user's configured games
      const userConfiguredGames = Object.entries(gameToProfileFlag)
        .filter(([game, flag]) => userProfile[flag])
        .map(([game]) => game);

      // Check if user has any of the venue's supported games configured
      const matchingGames = zoneSupportedGames.filter((game) => {
        const flagKey = gameToProfileFlag[game];
        return flagKey && userProfile[flagKey];
      });

      if (matchingGames.length === 0) {
        const supportedLabels = zoneSupportedGames
          .map((g) => gameLabels[g] || g)
          .join(", ");
        const userGamesLabels = userConfiguredGames
          .map((g) => gameLabels[g] || g)
          .join(", ");

        // Different message based on whether user has any games at all
        if (userConfiguredGames.length > 0) {
          // User has games but they don't match venue
          Alert.alert(
            "Game Mismatch",
            `Your games: ${userGamesLabels}\n\nThis venue supports: ${supportedLabels}\n\nTo create a matchroom here, please add one of the venue's supported games to your profile.`,
            [
              {
                text: "Go Back",
                style: "cancel",
                onPress: () => router.back(),
              },
              {
                text: "Add Game",
                onPress: () => router.replace("/(player)/(tabs)/profile"),
              },
            ],
          );
        } else {
          // User has no games configured at all
          Alert.alert(
            "Add a Game First",
            `This venue supports: ${supportedLabels}\n\nPlease add one of these games to your profile to create a matchroom here.`,
            [
              {
                text: "Go Back",
                style: "cancel",
                onPress: () => router.back(),
              },
              {
                text: "Edit Profile",
                onPress: () => router.replace("/(player)/(tabs)/profile"),
              },
            ],
          );
        }
      }
    } catch (e) {
      Logger.error("CreateMatchroom", "Error parsing zoneSupportedGames", e);
    }
  }, [isZoneWalkInAdmin, userProfile, params.zoneSupportedGames]);

  const loadUserProfile = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const result = await getUserProfile(user.uid);
      if (result.ok) {
        setUserProfile(result.data);
      } else {
        // Profile doesn't exist - user needs to complete registration
        Logger.warn(
          "CreateMatchroom",
          "User profile not found - redirecting to registration",
          result.message,
        );
        Alert.alert(
          "Profile Not Found",
          "Please complete your player registration first.",
          [
            {
              text: "Go to Profile",
              onPress: () => router.replace("/auth/register"),
            },
          ],
        );
      }
    } catch (error) {
      Logger.error("CreateMatchroom", "Error loading profile", error);
      Alert.alert(
        "Error",
        "Could not load your profile. Please try logging in again.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } finally {
      setLoading(false);
    }
  };

  const applyFormatDefaults = (gameKey: string, format: string) => {
    if (!gameKey || !format) return;
    if (gameKey === "fc26" || gameKey === "tekken8") {
      const nextMax = format === "2v2" ? 4 : 2;
      setFormData((prev) => ({
        ...prev,
        maxPlayers: nextMax,
        ...(titleTouched
          ? {}
          : {
            title: format === "2v2" ? "2v2 Competitive" : "1v1 Competitive",
          }),
      }));
      return;
    }
    if (gameKey === "futsal") {
      if (format === "5v5") {
        setFormData((prev) => ({
          ...prev,
          maxPlayers: 10,
          formation: prev.formation || "2-2 (Diamond)",
          ...(titleTouched ? {} : { title: "5v5 Futsal Match" }),
        }));
      } else if (format === "6v6") {
        setFormData((prev) => ({
          ...prev,
          maxPlayers: 12,
          formation: prev.formation || "2-2-1",
          ...(titleTouched ? {} : { title: "6v6 Futsal Match" }),
        }));
      }
      return;
    }
    if (gameKey === "indoor_cricket") {
      if (format === "8-a-side") {
        setFormData((prev) => ({
          ...prev,
          maxPlayers: 16,
          ...(titleTouched ? {} : { title: "8-a-side Indoor Cricket" }),
        }));
      }
      return;
    }
    if (gameKey === "padel") {
      setFormData((prev) => ({
        ...prev,
        maxPlayers: 4,
        format: "2v2",
        ...(titleTouched ? {} : { title: "2v2 Padel Match" }),
      }));
      return;
    }
    if (gameKey === "pickleball") {
      const nextMax = format === "2v2" ? 4 : 2;
      setFormData((prev) => ({
        ...prev,
        maxPlayers: nextMax,
        ...(titleTouched
          ? {}
          : {
            title:
              format === "2v2"
                ? "2v2 Pickleball Match"
                : "1v1 Pickleball Match",
          }),
      }));
      return;
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    if (field === "title") setTitleTouched(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "format" && selectedGame) {
      applyFormatDefaults(selectedGame, value);
    }
  };

  const handleGameSelect = async (gameKey: string) => {
    setSelectedGame(gameKey);

    // Auto-initialize hostRole from profile
    if (userProfile) {
      const role = getUserSportRoleLabel(userProfile, gameKey);
      if (role) {
        setHostRole(role);
      } else {
        setHostRole("Flex");
      }
    }

    // Auto-Initialize Skill Score if missing
    // Skill initialization is handled by SkillBracketSection; avoid side-effect writes here

    // Reset game-specific fields when changing game
    setFormData((prev) => ({
      ...prev,
      // Reset game-specific fields to defaults
      format: "",
      selectedMaps: [],
      skillLevel: "Any",
      playstyle: "",
      rankRequirement: "",
      overs: "",
      sidePreference: "",
      date: "",
      time: "",
      favouriteClub: "",
      formation: "",
      tekkenCharacters: [],
      composition: "",
      battingOrder: "",
      battingStyle: "",
      bowlingStyle: "",
      bowlingOrder: "",
      seriesType: "",
    }));
    setDuration(1); // Reset duration
    setTitleTouched(false);

    // Phase 2: Load teams for this game (player mode only)
    if (user && !isZoneWalkInAdmin) {
      const result = await getUserTeamsForGame(user.uid, gameKey as any);
      if (result.ok && result.data) {
        setTeams(result.data);
        // Reset team state
        setTeamMode("solo");
        setSelectedTeamId(null);
        setReservedSlots(1);
        setSelectedTeamMemberUids([]);
      }
    } else if (isZoneWalkInAdmin) {
      setTeams([]);
      setTeamMode("solo");
      setSelectedTeamId(null);
      setReservedSlots(1);
      setSelectedTeamMemberUids([]);
    }

    // Phase 4: Enforce CS2 Rules
    if (gameKey === "cs2") {
      console.log("[CS2 Auto-fill] UserProfile:", userProfile);
      console.log(
        "[CS2 Auto-fill] FACEIT Skill Level:",
        userProfile?.faceitSkillLevel,
      );

      // Map FACEIT skill level to band
      let skillLevel = "Any";
      if (userProfile?.faceitSkillLevel) {
        const level = userProfile.faceitSkillLevel;
        console.log("[CS2 Auto-fill] Mapping level:", level);
        if (level >= 1 && level <= 3) {
          skillLevel = "FACEIT 1-3";
        } else if (level >= 4 && level <= 6) {
          skillLevel = "FACEIT 4-6";
        } else if (level >= 7 && level <= 10) {
          skillLevel = "FACEIT 7-10";
        }
      }
      console.log("[CS2 Auto-fill] Setting skill level to:", skillLevel);

      setFormData((prev) => ({
        ...prev,
        title: "5v5 Competitive", // Default title
        format: "5v5",
        maxPlayers: 10,
        skillLevel: skillLevel,
      }));
      setSeriesType("BO1"); // Default series type for CS2
      // Initialize host role from profile
      if (userProfile?.cs2Role) {
        setHostRole(userProfile.cs2Role);
      } else {
        setHostRole(null);
      }
    } else if (gameKey === "fc26") {
      // FC26 Defaults
      setFormData((prev) => ({
        ...prev,
        title: "1v1 Competitive",
        format: "1v1",
        maxPlayers: 2, // 1v1 = 2 players total
        favouriteClub: userProfile?.fcTeam || "",
        formation: userProfile?.fcFormation || "",
      }));
      setSeriesType("BO3"); // Default to BO3 for FC
      setHostRole(null);
    } else if (gameKey === "tekken8") {
      // Tekken 8 Defaults
      setFormData((prev) => ({
        ...prev,
        title: "1v1 Competitive",
        format: "1v1",
        maxPlayers: 2,
        tekkenCharacters: userProfile?.tekkenFavorites || [],
        skillLevel: "Any", // Will be updated by SkillBracketSection
      }));
      setSeriesType("BO7"); // Default to BO7 for Tekken
      setHostRole(null);
    } else if (gameKey === "futsal") {
      // Futsal Defaults
      setFormData((prev) => ({
        ...prev,
        title: "5v5 Futsal Match",
        format: "5v5",
        maxPlayers: 10,
        formation: "2-2 (Diamond)", // Default formation for 5v5
      }));
      setDuration(1); // Default to 1 hour
      setHostRole(null);
    } else if (gameKey === "indoor_cricket") {
      // Indoor Cricket Defaults
      setFormData((prev) => ({
        ...prev,
        title: "8v8 competitive",
        format: "8-a-side",
        maxPlayers: 16,
        overs: "5", // Default to 5 overs
        composition: "Balanced",
      }));
      setSeriesType("BO3"); // Default/Only option
      setHostRole(userProfile?.indoorCricketRole || null);
    } else if (gameKey === "padel") {
      // Padel Defaults - Always 2v2, with series type
      setFormData((prev) => ({
        ...prev,
        title: "2v2 Padel Match",
        format: "2v2",
        maxPlayers: 4,
        seriesType: "BO3", // Default to BO3 (1 hour)
      }));
      setDuration(1); // Default to 1 hour (BO3)
      setHostRole(userProfile?.padelRole || null);
    } else if (gameKey === "pickleball") {
      // Pickleball Defaults
      setFormData((prev) => ({
        ...prev,
        title: "1v1 Pickleball Match",
        format: "1v1",
        maxPlayers: 2,
        seriesType: "BO3", // Default to BO3 (1 hour)
      }));
      setDuration(1);
      setHostRole(null);
    } else {
      setHostRole(null);
    }
  };

  const validateForm = () => {
    const fail = (title: string, message: string, reason: string) => {
      Logger.debug("CreateMatchroom", "Validation blocked submit", { reason });
      Alert.alert(title, message);
      return false;
    };

    if (isZoneWalkInAdmin) {
      if (!adminZone?.id) {
        return fail(
          "Zone Not Found",
          "Unable to resolve your venue. Please try again.",
          "admin_zone_missing",
        );
      }
      if (!selectedGame) {
        return fail(
          "Missing Game",
          "Please select a game/sport",
          "missing_game",
        );
      }
      if (!formData.title?.trim()) {
        return fail(
          "Missing Title",
          "Please enter a match title",
          "missing_title",
        );
      }
      if (!formData.date || !formData.time) {
        return fail(
          "Missing Date/Time",
          "Please enter date and time",
          "missing_date_time",
        );
      }

      const seatCount = Number.parseInt(walkInSeatCount, 10);
      const maxSeats = Math.max(1, Number(formData.maxPlayers || 0));
      if (!Number.isFinite(seatCount) || seatCount < 0) {
        return fail(
          "Invalid Seats",
          "Booked seats cannot be negative.",
          "invalid_walkin_seat_count_negative",
        );
      }
      if (seatCount > maxSeats) {
        return fail(
          "Invalid Seats",
          `Booked seats cannot exceed total seats (${maxSeats}).`,
          "invalid_walkin_seat_count_exceeds",
        );
      }

      const normalizedBookedSeats = Math.max(
        0,
        Math.min(maxSeats, Math.floor(seatCount)),
      );
      if (normalizedBookedSeats > 0) {
        const missingPlayerNameIndex = walkInSeatPlayers
          .slice(0, normalizedBookedSeats)
          .findIndex((player) => !player.name?.trim());
        if (missingPlayerNameIndex >= 0) {
          return fail(
            "Missing User Name",
            `Please enter player ${missingPlayerNameIndex + 1} User Name.`,
            "walkin_missing_player_name",
          );
        }
        if (
          !walkInCaptainSeatNumber ||
          walkInCaptainSeatNumber < 1 ||
          walkInCaptainSeatNumber > normalizedBookedSeats
        ) {
          return fail(
            "Missing Captain",
            "Please select a captain from booked walk-in players.",
            "walkin_missing_captain",
          );
        }
      }

      if (!WALKIN_SERIES_OPTIONS.includes(seriesType as WalkInSeriesType)) {
        return fail(
          "Missing Series",
          "Please select series type (BO1, BO3, or BO5).",
          "invalid_walkin_series",
        );
      }

      if (zoneRateOptions.length > 0 && !selectedZoneRateKey) {
        return fail(
          "Missing Rate Type",
          "Please select a rate type to calculate price per player.",
          "walkin_zone_rate_type_missing",
        );
      }

      if (adminBranches.length > 1 && !walkInBranchId) {
        return fail(
          "Missing Branch",
          "Select a branch for this walk-in booking.",
          "walkin_branch_missing",
        );
      }

      return true;
    }

    if (!selectedGame) {
      return fail("Missing Game", "Please select a game/sport", "missing_game");
    }
    if (!formData.title?.trim()) {
      return fail(
        "Missing Title",
        "Please enter a match title",
        "missing_title",
      );
    }
    if (!formData.maxPlayers || formData.maxPlayers < 2) {
      return fail(
        "Invalid Players",
        "Please enter a valid number of players (minimum 2)",
        "invalid_max_players",
      );
    }
    if (!formData.format) {
      return fail(
        "Missing Format",
        "Please select a match format",
        "missing_format",
      );
    }
    if (!formData.date || !formData.time) {
      return fail(
        "Missing Date/Time",
        "Please enter date and time",
        "missing_date_time",
      );
    }
    if (!isDateAllowed) {
      const label = teamMode === "team" ? "captains" : "solo players";
      return fail(
        "Date Too Soon",
        `Earliest date for ${label} is ${minAllowedDate.toLocaleDateString()}.`,
        "invalid_date_lead_time",
      );
    }
    if (teamMode === "team") {
      if (!isCaptainForGame) {
        return fail(
          "Not Authorized",
          "Only team captains can book multiple reserved slots.",
          "team_mode_not_captain",
        );
      }
      if (!selectedTeamId) {
        return fail(
          "Missing Team",
          "Please select your team.",
          "team_mode_missing_team",
        );
      }
      if (reservedSlots < 2 || reservedSlots > 5) {
        return fail(
          "Invalid Slots",
          "Reserved slots must be between 2 and 5.",
          "team_mode_invalid_reserved_slots",
        );
      }
      const needed = Math.max(0, reservedSlots - 1);
      if (selectedTeamMemberUids.length !== needed) {
        return fail(
          "Select Players",
          `Please select ${needed} player${needed === 1 ? "" : "s"} from your team.`,
          "team_mode_missing_players",
        );
      }
    }
    // Phase 3: Zone validation
    if (locationMode === "zone" && !selectedZoneId) {
      return fail(
        "Missing Zone",
        "Please select a zone to host the match",
        "zone_missing",
      );
    }
    if (
      locationMode === "zone" &&
      selectedZoneId &&
      zoneRateOptions.length > 0 &&
      !selectedZoneRateKey
    ) {
      return fail(
        "Missing Rate Type",
        "Please select a rate type to calculate price per player.",
        "zone_rate_type_missing",
      );
    }
    // Phase 3: Broadcast validation
    if (
      locationMode === "broadcast" &&
      broadcastAreas.length === 0 &&
      (!userProfile?.areasPreferred || userProfile.areasPreferred.length === 0)
    ) {
      return fail(
        "Missing Areas",
        "Please select at least one area for broadcast",
        "broadcast_area_missing",
      );
    }
    return true;
  };

  const promptPaymentChoice = async (amountDue: number) => {
    return await new Promise<"paid" | "unpaid" | "cancel">((resolve) => {
      Alert.alert(
        "Payment Required",
        `To send this request to the admin, payment is required.\n\nAmount (placeholder): â‚¨ ${amountDue}\n\nChoose an option:`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
          { text: "Create Pending", onPress: () => resolve("unpaid") },
          { text: "Pay Now (Placeholder)", onPress: () => resolve("paid") },
        ],
      );
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (isZoneWalkInAdmin) {
      setSubmitting(true);
      try {
        if (!adminZone?.id) {
          Alert.alert("Zone Not Found", "Unable to resolve zone context.");
          return;
        }

        const seatCount = Number.parseInt(walkInSeatCount, 10);
        const walkInSeries = WALKIN_SERIES_OPTIONS.includes(
          seriesType as WalkInSeriesType,
        )
          ? (seriesType as WalkInSeriesType)
          : "BO1";
        const durationMinutes = getWalkInDurationMinutes(
          selectedGame,
          walkInSeries,
          formData.overs,
        );
        const pricePerPlayer = Math.max(
          0,
          Math.ceil(Number(formData.pricePerPlayer || 0)),
        );
        const branch =
          selectedAdminBranch ||
          (adminBranches.length === 1 ? adminBranches[0] : null);
        const totalSeats = selectedGame === 'cs2' ? 10 : Math.max(1, Number(formData.maxPlayers || 0));
        const bookedSeats = Number.isFinite(seatCount)
          ? Math.max(0, Math.min(totalSeats, Math.floor(seatCount)))
          : totalSeats;
        const walkInSeed = Date.now();
        const captainSeatNumber =
          walkInCaptainSeatNumber &&
            walkInCaptainSeatNumber >= 1 &&
            walkInCaptainSeatNumber <= bookedSeats
            ? walkInCaptainSeatNumber
            : bookedSeats > 0
              ? 1
              : null;
        const knownPlayers = walkInSeatPlayers
          .slice(0, bookedSeats)
          .map((player, idx) => ({
            uid: `walkin_${user.uid}_${walkInSeed}_${idx + 1}`,
            username: player.name.trim() || `Player ${idx + 1}`,
            skillTier: player.skillTier,
            seatNumber: idx + 1,
            isCaptain: captainSeatNumber === idx + 1,
          }));

        const result = await createZoneWalkInMatchroom({
          zoneId: adminZone.id,
          zoneOwnerUid: adminZone.ownerUid || user.uid,
          branchId: branch?.id || null,
          branchName: branch?.label || null,
          adminUid: user.uid,
          adminName:
            user.displayName || adminZone.ownerFullName || "Zone Admin",
          gameKey: selectedGame || "unknown",
          title: formData.title.trim() || "Walk-in Matchroom",
          scheduledDate: formData.date,
          scheduledTime: formData.time,
          durationMinutes,
          seriesType: walkInSeries,
          seatCount: totalSeats,
          bookedSeatCount: bookedSeats,
          paymentMode: walkInPaymentMode,
          pricePerPlayer,
          currency: "PKR",
          captainSeatNumber,
          knownPlayers,
        });

        if (!result.ok) {
          Alert.alert(
            "Walk-in failed",
            result.message || "Failed to create walk-in matchroom.",
          );
          return;
        }

        Alert.alert(
          "Walk-in created",
          "Walk-in matchroom created successfully.",
          [
            {
              text: "Open",
              onPress: () => router.replace(`/matchrooms/${result.id}` as any),
            },
            {
              text: "Back to Walk-ins",
              onPress: () =>
                router.replace({
                  pathname: "/zone/modules/bookings",
                  params: { segment: "walkins", t: Date.now().toString() },
                } as any),
            },
          ],
        );
      } catch (error) {
        Logger.error("CreateMatchroom", "Error creating admin walk-in", error);
        Alert.alert(
          "Error",
          "Something went wrong while creating walk-in matchroom.",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!userProfile) {
      Alert.alert(
        "Profile Missing",
        "We could not load your profile yet. Please try again in a moment.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const seatsPaid =
        teamMode === "team"
          ? teamPaymentMode === "captain_pays_all"
            ? reservedSlots
            : 1
          : 1;
      const amountDue = Math.ceil((formData.pricePerPlayer || 0) * seatsPaid);
      const paymentChoice = await promptPaymentChoice(amountDue);
      if (paymentChoice === "cancel") {
        setSubmitting(false);
        return;
      }
      const paymentStatus = paymentChoice;

      // Phase 3: If broadcast mode, create booking request instead of matchroom
      if (locationMode === "broadcast") {
        const requestData: Omit<BookingRequest, "id" | "createdAt" | "status"> =
        {
          userId: user.uid,
          userName:
            userProfile.displayName || userProfile.username || "Player",
          gameKey: selectedGame!,
          title: formData.title.trim(),
          description: formData.description?.trim() || "",
          maxPlayers: formData.maxPlayers,
          format: formData.format,
          seriesType:
            selectedGame === "cs2" ||
              selectedGame === "fc26" ||
              selectedGame === "tekken8"
              ? seriesType
              : selectedGame === "padel" || selectedGame === "pickleball"
                ? formData.seriesType || null
                : null,
          durationHours: selectedGame === "futsal" ? duration : null,
          selectedMaps: formData.selectedMaps || [],

          // Skill Info
          skillLevel: formData.skillLevel || "Any",
          hostSkillScore: hostSkillScore ?? null,
          hostSkillTier: hostSkillTier ?? "Any",
          hostSkillContext: {
            gameKey: selectedGame!,
            answers: hostSkillAnswers || {},
          },

          overs: formData.overs || null,
          teamMode: teamMode,
          teamId: teamMode === "team" ? selectedTeamId || null : null,
          reservedSlots: teamMode === "team" ? reservedSlots : 1,
          preferredDate: formData.date || undefined,
          preferredTime: formData.time || undefined,
          flexibilityWindow: "Exact time",
          preferredAreas:
            broadcastAreas.length > 0
              ? broadcastAreas
              : userProfile.areasPreferred || [],
          budgetPerPlayer: formData.pricePerPlayer || 0,
          currency: "PKR",

          paymentStatus,
          paymentAmount: amountDue,
          paymentReservedSlots: seatsPaid,
        };

        const result = await createBookingRequest(requestData, {
          status: paymentStatus === "paid" ? "open" : "pending_payment",
        });

        if (result.ok) {
          Alert.alert(
            paymentStatus === "paid"
              ? "Broadcast Sent!"
              : "Request Created (Pending Payment)",
            paymentStatus === "paid"
              ? 'Zone admins in your preferred areas will send you offers. Check "My Requests" to view offers.'
              : "This request is pending payment and has not been sent to admins yet (placeholder).",
            [{ text: "OK", onPress: () => router.back() }],
          );
        } else {
          Alert.alert("Error", result.message || "Failed to create request");
        }
        setSubmitting(false);
        return;
      }

      // Phase 1 & 2: Normal matchroom creation (zone mode)
      const matchroomData = {
        hostUid: user.uid,
        hostName: userProfile.username || userProfile.displayName || "Player",
        game: selectedGame!,
        title: formData.title.trim(),
        description: formData.description?.trim() || "",
        maxPlayers: selectedGame === 'cs2' ? 10 : formData.maxPlayers,
        bookingSource: isZoneWalkInAdmin ? 'walkin' : undefined,
        status: "open" as const,
        isLocked: paymentStatus === "unpaid",
        paymentStatus,
        paymentAmount: amountDue,
        paymentReservedSlots: seatsPaid,
        paymentCurrency: "PKR",
        matchCode: generateMatchCode(selectedZoneName),
        pricing: {
          perPlayer: formData.pricePerPlayer || 0,
          currency: "PKR",
        },
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        durationMinutes: (() => {
          if (selectedGame === "futsal") return duration * 60;
          if (selectedGame === "indoor_cricket") {
            if (formData.overs === "6") return 2.5 * 60; // 6 overs = 2.5h
            return 2 * 60; // 5 overs = 2h
          }
          if (selectedGame === "cs2") {
            if (seriesType === "BO1") return 60;
            if (seriesType === "BO3") return 180;
            if (seriesType === "BO5") return 300;
            if (seriesType === "BO10") return 600;
          }
          if (selectedGame === "fc26") {
            if (seriesType === "BO1") return 30;
            if (seriesType === "BO3") return 60;
            if (seriesType === "BO5") return 120;
            if (seriesType === "BO10") return 180;
          }
          if (selectedGame === "tekken8") {
            if (seriesType === "BO7") return 60;
            if (seriesType === "BO20") return 120;
            if (seriesType === "BO40") return 180;
          }
          if (selectedGame === "padel" || selectedGame === "pickleball") {
            if (formData.seriesType === "BO5") return 120;
            if (formData.seriesType === "BO10") return 180;
            return 60; // Default BO3 = 1h
          }
          return 60; // Fallback default
        })(),

        // Tekken characters
        tekkenCharacters:
          selectedGame === "tekken8" ? formData.tekkenCharacters : undefined,

        // Game-specific fields (structured)
        format: formData.format,
        seriesType:
          selectedGame === "cs2" ||
            selectedGame === "fc26" ||
            selectedGame === "tekken8"
            ? seriesType
            : selectedGame === "padel" || selectedGame === "pickleball"
              ? formData.seriesType || null
              : null,
        durationHours: selectedGame === "futsal" ? duration : null,
        selectedMaps: formData.selectedMaps || [],

        // Skill System
        skillLevel: hostSkillTier || formData.skillLevel || "Any",
        hostSkillScore: hostSkillScore ?? null,
        hostSkillTier: hostSkillTier ?? "Any",
        hostSkillContext: {
          gameKey: selectedGame,
          answers: hostSkillAnswers || {},
        },
        hostRole: hostRole || "Flex",

        playstyle: formData.playstyle || null,
        rankRequirement: formData.rankRequirement || null,
        overs: formData.overs || null,
        sidePreference: formData.sidePreference || null,
        composition:
          selectedGame === "indoor_cricket" ? formData.composition : null,
        battingOrder:
          selectedGame === "indoor_cricket" ? formData.battingOrder : null,
        battingStyle:
          selectedGame === "indoor_cricket" ? formData.battingStyle : null,
        bowlingStyle:
          selectedGame === "indoor_cricket" ? formData.bowlingStyle : null,
        bowlingOrder:
          selectedGame === "indoor_cricket" ? formData.bowlingOrder : null,

        // Location (Phase 1: zone only)
        locationMode: "zone" as const,
        location: selectedZoneName || "TBD",
        zoneId: selectedZoneId || undefined,

        // Team fields (Phase 2)
        teamMode: teamMode,
        teamId: teamMode === "team" ? selectedTeamId || null : null,
        teamName:
          teamMode === "team"
            ? teams.find((t: Team) => t.id === selectedTeamId)?.name || null
            : null,
        reservedSlots: teamMode === "team" ? reservedSlots : 1,
        teamPaymentMode: teamMode === "team" ? teamPaymentMode : undefined,
        assignedTeamMembers:
          teamMode === "team" && resolvedTeam
            ? [
              {
                uid: resolvedTeam.captainUid,
                username:
                  resolvedTeam.captainUsername ||
                  userProfile.username ||
                  userProfile.displayName ||
                  "Captain",
                role: memberSportRoleByUid[resolvedTeam.captainUid]
                  ? `Captain â€¢ ${memberSportRoleByUid[resolvedTeam.captainUid]}`
                  : "Captain",
              },
              ...selectedTeamMemberUids.map((uid) => {
                const m = selectableTeamMembers.find((x) => x.uid === uid);
                return {
                  uid,
                  username: m?.username || "Team Member",
                  role: memberSportRoleByUid[uid] || "Player",
                };
              }),
            ].slice(0, reservedSlots)
            : [],

        // Required roles (optional)
        requiredRoles: [],

        // Walk-in Data (Critical for admin flow)
        walkIn: isZoneWalkInAdmin
          ? {
            seatCount: Number.parseInt(walkInSeatCount, 10),
            bookedSeatCount: Math.floor(Number(walkInSeatCount)), // normalized
            captainSeatNumber: walkInCaptainSeatNumber,
            roster: walkInSeatPlayers.slice(
              0,
              Math.floor(Number(walkInSeatCount)),
            ),
            branchId: walkInBranchId,
          }
          : null,
      };

      // Helper to remove undefined values
      const sanitizeData = (data: any) => {
        const cleaned: any = {};
        Object.keys(data).forEach((key) => {
          const value = data[key];
          if (value !== undefined) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      };

      const result = await createMatchroom(sanitizeData(matchroomData) as any);

      if (result.ok) {
        Alert.alert(
          "Success!",
          paymentStatus === "paid"
            ? "Your matchroom has been created"
            : "Your matchroom is pending payment (placeholder) and is locked until paid.",
          [
            {
              text: "View Match",
              onPress: () => router.replace(`/matchrooms/${result.id}`),
            },
          ],
        );
      } else {
        Alert.alert("Error", result.message || "Failed to create matchroom");
      }
    } catch (error) {
      Logger.error("CreateMatchroom", "Error creating matchroom", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitBlockers = useMemo(() => {
    if (isZoneWalkInAdmin) {
      const blockers: string[] = [];
      if (!selectedGame) blockers.push("Select a game");
      if (!formData.title?.trim()) blockers.push("Enter match title");
      if (!formData.date || !formData.time) blockers.push("Pick date and time");
      const seatCount = Number.parseInt(walkInSeatCount, 10);
      const maxSeats = Math.max(1, Number(formData.maxPlayers || 0));
      if (!Number.isFinite(seatCount) || seatCount < 0)
        blockers.push("Booked seats cannot be negative");
      if (Number.isFinite(seatCount) && seatCount > maxSeats)
        blockers.push(`Booked seats cannot exceed ${maxSeats}`);
      const normalizedBookedSeats = Number.isFinite(seatCount)
        ? Math.max(0, Math.min(maxSeats, Math.floor(seatCount)))
        : 0;
      if (normalizedBookedSeats > 0) {
        const missingNameIndex = walkInSeatPlayers
          .slice(0, normalizedBookedSeats)
          .findIndex((player) => !player.name?.trim());
        if (missingNameIndex >= 0)
          blockers.push(`Enter player ${missingNameIndex + 1} name`);
        if (
          !walkInCaptainSeatNumber ||
          walkInCaptainSeatNumber < 1 ||
          walkInCaptainSeatNumber > normalizedBookedSeats
        ) {
          blockers.push("Select captain");
        }
      }
      if (!WALKIN_SERIES_OPTIONS.includes(seriesType as WalkInSeriesType))
        blockers.push("Select series type");
      if (zoneRateOptions.length > 0 && !selectedZoneRateKey)
        blockers.push("Select zone rate type");
      if (adminBranches.length > 1 && !walkInBranchId)
        blockers.push("Select branch");
      return blockers;
    }

    const blockers: string[] = [];
    if (!selectedGame) blockers.push("Select a game");
    if (!formData.title?.trim()) blockers.push("Enter match title");
    if (!formData.format) blockers.push("Select match format");
    if (!formData.date || !formData.time) blockers.push("Pick date and time");
    if (!isDateAllowed)
      blockers.push(
        `Earliest allowed date is ${minAllowedDate.toLocaleDateString()}`,
      );
    if (locationMode === "zone" && !selectedZoneId)
      blockers.push("Select a zone/court");
    if (
      locationMode === "zone" &&
      selectedZoneId &&
      zoneRateOptions.length > 0 &&
      !selectedZoneRateKey
    ) {
      blockers.push("Select zone rate type");
    }
    if (teamMode === "team") {
      if (!selectedTeamId) blockers.push("Select your team");
      const needed = Math.max(0, reservedSlots - 1);
      if (selectedTeamMemberUids.length !== needed) {
        blockers.push(`Select ${needed} teammate${needed === 1 ? "" : "s"}`);
      }
    }
    return blockers;
  }, [
    isZoneWalkInAdmin,
    selectedGame,
    formData.title,
    formData.format,
    formData.date,
    formData.time,
    isDateAllowed,
    minAllowedDate,
    locationMode,
    selectedZoneId,
    zoneRateOptions.length,
    selectedZoneRateKey,
    teamMode,
    selectedTeamId,
    selectedTeamMemberUids.length,
    reservedSlots,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInCaptainSeatNumber,
    seriesType,
    adminBranches.length,
    walkInBranchId,
  ]);

  const canSubmit = submitBlockers.length === 0;
  const walkInComputedPrice = Math.max(
    0,
    Math.ceil(Number(formData.pricePerPlayer || 0)),
  );
  const walkInSeries = WALKIN_SERIES_OPTIONS.includes(
    seriesType as WalkInSeriesType,
  )
    ? (seriesType as WalkInSeriesType)
    : "BO1";
  const walkInEstimatedDurationMinutes = getWalkInDurationMinutes(
    selectedGame,
    walkInSeries,
    formData.overs,
  );
  const ctaBottomGuard = Math.max(insets.bottom + 12, 96);
  if (loading) {
    return (
      <Screen style={styles.screen} scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </Screen>
    );
  }

  if (isZoneWalkInAdmin) {
    return (
      <Screen
        style={styles.screen}
        scroll
        keyboardAvoiding
        contentStyle={styles.scrollContent}
        scrollProps={{
          showsVerticalScrollIndicator: false,
          keyboardShouldPersistTaps: "always",
        }}
      >
        <AppHeader
          title="Create Matchroom"
          subtitle="Walk-in mode for zone admin"
          onBack={() => router.back()}
          inlineTitle
        />

        <GameSelector
          selectedGame={selectedGame}
          onSelectGame={handleGameSelect}
          userProfile={userProfile}
          allowAllGames
          allowedGameKeys={walkInSupportedGameKeys}
        />

        {selectedGame && (
          <>
            <BasicFields
              formData={formData}
              onChange={handleFieldChange}
              selectedGame={selectedGame || undefined}
              minimumDate={minAllowedDate}
              dateHelperText="Select start date and time for walk-in matchroom."
            />

            {/* Game-Specific Dynamic Fields (Global options like Format) */}
            <GameDynamicFields
              gameKey={selectedGame}
              formData={formData}
              onChange={handleFieldChange}
              scope="global"
            />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Branch
                {adminBranches.length > 1 ? (
                  <Text style={styles.requiredAsterisk}>*</Text>
                ) : null}
              </Text>
              {adminBranches.length === 0 ? (
                <Text style={styles.helperTextTiny}>
                  No branch data found. Primary zone context will be used.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {adminBranches.map((branch) => {
                    const active = walkInBranchId === branch.id;
                    return (
                      <Pressable
                        key={branch.id}
                        style={[
                          styles.optionChip,
                          active && styles.optionChipActive,
                        ]}
                        onPress={() => setWalkInBranchId(branch.id)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {branch.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Payment Mode<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {(["venue_pay", "guest_pay"] as const).map((mode) => {
                  const active = walkInPaymentMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                      onPress={() => setWalkInPaymentMode(mode)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          active && styles.optionChipTextActive,
                        ]}
                      >
                        {mode === "venue_pay" ? "Paid by Venue" : "Guests Pay"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {zoneRateOptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.fieldLabel}>
                  Rate type<Text style={styles.requiredAsterisk}>*</Text>
                </Text>
                <View style={styles.chipRow}>
                  {zoneRateOptions.map((opt) => {
                    const active = selectedZoneRateKey === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        style={[
                          styles.optionChip,
                          active && styles.optionChipActive,
                        ]}
                        onPress={() => {
                          setSelectedZoneRateKey(opt.key);
                          setZoneRate(opt.price);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            active && styles.optionChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Walk-in Setup<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.tabContainer}>
                {!(selectedGame === 'fc26' || selectedGame === 'tekken8') && (
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>
                      Booked seats<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        placeholder="6"
                        placeholderTextColor="#757575"
                        keyboardType="number-pad"
                        value={walkInSeatCount}
                        onChangeText={handleWalkInSeatCountChange}
                      />
                    </View>
                    <Text style={styles.helperTextTiny}>
                      Total seats: {walkInMaxSeatLimit}
                    </Text>
                  </View>
                )}
              </View>
              {walkInBookedSeatCount > 0 ? (
                <View style={styles.walkInRosterWrap}>
                  {selectedGame === 'cs2' && walkInBookedSeatCount > 0 ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      {/* Team A Column */}
                      <View style={{ width: '48%' }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: COLORS.accent }]}>Team A</Text>
                        {walkInSeatPlayers.slice(0, 5).map((player, idx) => {
                          const originalIdx = idx;
                          return (
                            <View key={`walkin-seat-player-${originalIdx + 1}`} style={[styles.walkInPlayerCard, { marginBottom: 12 }]}>
                              <View style={styles.walkInPlayerHeader}>
                                <Text style={styles.walkInPlayerTitle}>Player {originalIdx + 1}</Text>
                                <Pressable
                                  style={[styles.optionChip, styles.walkInCaptainChip, walkInCaptainSeatNumber === originalIdx + 1 && styles.optionChipActive]}
                                  onPress={() => setWalkInCaptainSeatNumber(originalIdx + 1)}
                                >
                                  <Text style={[styles.optionChipText, walkInCaptainSeatNumber === originalIdx + 1 && styles.optionChipTextActive]}>C</Text>
                                </Pressable>
                              </View>
                              <Text style={styles.fieldLabel}>Name*</Text>
                              <View style={styles.inputBox}>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Name"
                                  placeholderTextColor="#757575"
                                  value={player.name}
                                  onChangeText={(value) =>
                                    setWalkInSeatPlayers((prev) =>
                                      prev.map((item) => (item.seatNumber === player.seatNumber ? { ...item, name: value } : item))
                                    )
                                  }
                                />
                              </View>
                              <Text style={styles.fieldLabel}>Rank*</Text>
                              <View style={styles.chipRow}>
                                {WALKIN_SKILL_TIER_OPTIONS.map((tier) => (
                                  <Pressable
                                    key={`${player.seatNumber}-${tier}`}
                                    style={[styles.optionChip, player.skillTier === tier && styles.optionChipActive, { paddingHorizontal: 8, minWidth: 0 }]}
                                    onPress={() =>
                                      setWalkInSeatPlayers((prev) =>
                                        prev.map((item) => (item.seatNumber === player.seatNumber ? { ...item, skillTier: tier } : item))
                                      )
                                    }
                                  >
                                    <Text style={[styles.optionChipText, player.skillTier === tier && styles.optionChipTextActive, { fontSize: 10 }]}>{tier}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {/* Team B Column */}
                      <View style={{ width: '48%' }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 8, color: COLORS.error }]}>Team B</Text>
                        {walkInSeatPlayers.slice(5, 10).map((player, idx) => {
                          const originalIdx = idx + 5;
                          return (
                            <View key={`walkin-seat-player-${originalIdx + 1}`} style={[styles.walkInPlayerCard, { marginBottom: 12 }]}>
                              <View style={styles.walkInPlayerHeader}>
                                <Text style={styles.walkInPlayerTitle}>Player {originalIdx + 1}</Text>
                                <Pressable
                                  style={[styles.optionChip, styles.walkInCaptainChip, walkInCaptainSeatNumber === originalIdx + 1 && styles.optionChipActive]}
                                  onPress={() => setWalkInCaptainSeatNumber(originalIdx + 1)}
                                >
                                  <Text style={[styles.optionChipText, walkInCaptainSeatNumber === originalIdx + 1 && styles.optionChipTextActive]}>C</Text>
                                </Pressable>
                              </View>
                              <Text style={styles.fieldLabel}>Name*</Text>
                              <View style={styles.inputBox}>
                                <TextInput
                                  style={styles.input}
                                  placeholder="Name"
                                  placeholderTextColor="#757575"
                                  value={player.name}
                                  onChangeText={(value) =>
                                    setWalkInSeatPlayers((prev) =>
                                      prev.map((item) => (item.seatNumber === player.seatNumber ? { ...item, name: value } : item))
                                    )
                                  }
                                />
                              </View>
                              <Text style={styles.fieldLabel}>Rank*</Text>
                              <View style={styles.chipRow}>
                                {WALKIN_SKILL_TIER_OPTIONS.map((tier) => (
                                  <Pressable
                                    key={`${player.seatNumber}-${tier}`}
                                    style={[styles.optionChip, player.skillTier === tier && styles.optionChipActive, { paddingHorizontal: 8, minWidth: 0 }]}
                                    onPress={() =>
                                      setWalkInSeatPlayers((prev) =>
                                        prev.map((item) => (item.seatNumber === player.seatNumber ? { ...item, skillTier: tier } : item))
                                      )
                                    }
                                  >
                                    <Text style={[styles.optionChipText, player.skillTier === tier && styles.optionChipTextActive, { fontSize: 10 }]}>{tier}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>
                        Walk-in Player Details
                        <Text style={styles.requiredAsterisk}>*</Text>
                      </Text>
                      {walkInSeatPlayers
                        .slice(0, walkInBookedSeatCount)
                        .map((player, idx) => (
                          <View
                            key={`walkin-seat-player-${idx + 1}`}
                            style={styles.walkInPlayerCard}
                          >
                            <View style={styles.walkInPlayerHeader}>
                              <Text style={styles.walkInPlayerTitle}>
                                Player {idx + 1}
                              </Text>
                              <Pressable
                                style={[
                                  styles.optionChip,
                                  styles.walkInCaptainChip,
                                  walkInCaptainSeatNumber === idx + 1 &&
                                  styles.optionChipActive,
                                ]}
                                onPress={() => setWalkInCaptainSeatNumber(idx + 1)}
                              >
                                <Text
                                  style={[
                                    styles.optionChipText,
                                    walkInCaptainSeatNumber === idx + 1 &&
                                    styles.optionChipTextActive,
                                  ]}
                                >
                                  Captain
                                </Text>
                              </Pressable>
                            </View>

                            <Text style={styles.fieldLabel}>
                              User Name<Text style={styles.requiredAsterisk}>*</Text>
                            </Text>
                            <View style={styles.inputBox}>
                              <TextInput
                                style={styles.input}
                                placeholder="Zywoo, monesy, s1mple"
                                placeholderTextColor="#757575"
                                value={player.name}
                                onChangeText={(value) =>
                                  setWalkInSeatPlayers((prev) =>
                                    prev.map((item) =>
                                      item.seatNumber === player.seatNumber
                                        ? { ...item, name: value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </View>

                            <Text style={styles.fieldLabel}>
                              Skill tier
                              <Text style={styles.requiredAsterisk}>*</Text>
                            </Text>
                            <View style={styles.chipRow}>
                              {WALKIN_SKILL_TIER_OPTIONS.map((tier) => {
                                const active = player.skillTier === tier;
                                return (
                                  <Pressable
                                    key={`${player.seatNumber}-${tier}`}
                                    style={[
                                      styles.optionChip,
                                      active && styles.optionChipActive,
                                    ]}
                                    onPress={() =>
                                      setWalkInSeatPlayers((prev) =>
                                        prev.map((item) =>
                                          item.seatNumber === player.seatNumber
                                            ? { ...item, skillTier: tier }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <Text
                                      style={[
                                        styles.optionChipText,
                                        active && styles.optionChipTextActive,
                                      ]}
                                    >
                                      {tier}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>

                            {/* Per-Player Game Fields (Character, Club, Formation) */}
                            {selectedGame && (
                              <GameDynamicFields
                                gameKey={selectedGame}
                                formData={player}
                                scope="player"
                                onChange={(field, value) => {
                                  setWalkInSeatPlayers((prev) =>
                                    prev.map((item) =>
                                      item.seatNumber === player.seatNumber
                                        ? { ...item, [field]: value }
                                        : item,
                                    ),
                                  );
                                }}
                              />
                            )}

                          </View>
                        ))}
                    </>
                  )}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.fieldLabel}>
                Series type<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {WALKIN_SERIES_OPTIONS.map((option) => {
                  const active = seriesType === option;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.optionChip,
                        active && styles.optionChipActive,
                      ]}
                      onPress={() => setSeriesType(option)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          active && styles.optionChipTextActive,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperTextTiny}>
                Estimated duration:{" "}
                {Math.floor(walkInEstimatedDurationMinutes / 60)}h
                {walkInEstimatedDurationMinutes % 60
                  ? ` ${walkInEstimatedDurationMinutes % 60}m`
                  : ""}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Price per player (PKR)</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  editable={false}
                  selectTextOnFocus={false}
                  value={`${walkInComputedPrice}`}
                />
              </View>
              <Text style={styles.helperTextTiny}>
                Calculated automatically from game format, series type, and
                selected rate.
              </Text>
            </View>

            <View style={[styles.buttonWrapper, { marginBottom: ctaBottomGuard }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!canSubmit || submitting) && styles.primaryButtonDisabled,
                  pressed &&
                  canSubmit &&
                  !submitting &&
                  styles.primaryButtonPressed,
                ]}
                onPress={() => {
                  if (!validateForm()) return;
                  handleSubmit();
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Create Walk-in Matchroom
                  </Text>
                )}
              </Pressable>
              {!canSubmit && (
                <Text style={[styles.helperTextTiny, styles.submitHintText]}>
                  Complete required fields: {submitBlockers[0]}
                </Text>
              )}
            </View>
          </>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      style={styles.screen}
      scroll
      keyboardAvoiding
      contentStyle={styles.scrollContent}
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "always",
      }}
    >
      <AppHeader
        title="Create Matchroom"
        subtitle="Set up your match and invite players"
        onBack={() => router.back()}
        inlineTitle
      />

      {/* Game Selector */}
      <GameSelector
        selectedGame={selectedGame}
        onSelectGame={handleGameSelect}
        userProfile={userProfile}
      />

      {selectedGame && (
        <>
          {/* Profile Auto-fill */}
          <RoleAutoFill
            gameKey={selectedGame}
            profile={userProfile}
            selectedRole={hostRole}
            onRoleChange={setHostRole}
            formData={formData}
            onChange={handleFieldChange}
          />

          {/* Basic Fields */}
          <BasicFields
            formData={formData}
            onChange={handleFieldChange}
            selectedGame={selectedGame || undefined}
            minimumDate={minAllowedDate}
            dateHelperText={
              teamMode === "team"
                ? `Captain booking: earliest allowed date is ${minAllowedDate.toLocaleDateString()}`
                : `Solo booking: earliest allowed date is ${minAllowedDate.toLocaleDateString()}`
            }
          />

          {/* Captain-only Booking Options */}
          {isCaptainForGame && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Booking Type<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {(["solo", "team"] as const).map((mode) => {
                  const isActive = teamMode === mode;
                  const label =
                    mode === "solo" ? "Solo (1 slot)" : "Captain (2-5 slots)";
                  return (
                    <Pressable
                      key={mode}
                      style={({ pressed }) => [
                        styles.optionChip,
                        isActive && styles.optionChipActive,
                        pressed && { opacity: 0.9 },
                      ]}
                      onPress={() => {
                        setTeamMode(mode);
                        if (mode === "solo") {
                          setReservedSlots(1);
                          setSelectedTeamId(null);
                          setSelectedTeamMemberUids([]);
                        } else {
                          if (reservedSlots < 2) setReservedSlots(2);
                          if (!selectedTeamId && captainedTeams[0]?.id)
                            setSelectedTeamId(captainedTeams[0].id);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          isActive && styles.optionChipTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {teamMode === "team" && (
                <>
                  <View
                    style={[styles.section, { marginBottom: 0, marginTop: 12 }]}
                  >
                    <Text style={styles.sectionLabel}>
                      Reserved Slots
                      <Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={styles.chipRow}>
                      {[2, 3, 4, 5].map((count) => {
                        const isActive = reservedSlots === count;
                        return (
                          <Pressable
                            key={count}
                            style={({ pressed }) => [
                              styles.optionChip,
                              isActive && styles.optionChipActive,
                              pressed && { opacity: 0.9 },
                            ]}
                            onPress={() => {
                              setReservedSlots(count);
                              setSelectedTeamMemberUids([]);
                            }}
                          >
                            <Text
                              style={[
                                styles.optionChipText,
                                isActive && styles.optionChipTextActive,
                              ]}
                            >
                              {count}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Text style={[styles.helperTextTiny, styles.marginTop8]}>
                      Captain counts as 1 slot. Select{" "}
                      {Math.max(0, reservedSlots - 1)} teammate
                      {reservedSlots - 1 === 1 ? "" : "s"} below.
                    </Text>
                  </View>

                  {resolvedTeam && (
                    <View
                      style={[
                        styles.section,
                        { marginBottom: 0, marginTop: 12 },
                      ]}
                    >
                      <Text style={styles.sectionLabel}>
                        Select Players
                        <Text style={styles.requiredAsterisk}>*</Text>
                      </Text>
                      {selectableTeamMembers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyTitle}>
                            No teammates found
                          </Text>
                          <Text style={styles.emptySubtitle}>
                            Invite teammates to your team first.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.memberGrid}>
                          {selectableTeamMembers.map((m) => {
                            const isActive = selectedTeamMemberUids.includes(
                              m.uid,
                            );
                            const limit = Math.max(0, reservedSlots - 1);
                            const disabled =
                              !isActive &&
                              selectedTeamMemberUids.length >= limit;
                            return (
                              <Pressable
                                key={m.uid}
                                style={({ pressed }) => [
                                  styles.memberCard,
                                  isActive && styles.memberCardSelected,
                                  disabled && { opacity: 0.5 },
                                  pressed && { opacity: 0.9 },
                                ]}
                                onPress={() => {
                                  if (disabled) return;
                                  setSelectedTeamMemberUids((prev) => {
                                    if (prev.includes(m.uid))
                                      return prev.filter((x) => x !== m.uid);
                                    return [...prev, m.uid];
                                  });
                                }}
                              >
                                <View style={styles.memberAvatar}>
                                  <Text style={styles.memberAvatarText}>
                                    {m.username?.charAt(0).toUpperCase() || "P"}
                                  </Text>
                                </View>
                                <View style={styles.memberInfo}>
                                  <Text
                                    style={styles.memberName}
                                    numberOfLines={1}
                                  >
                                    {m.username}
                                  </Text>
                                  <View style={styles.memberRoleBadge}>
                                    <Text
                                      style={styles.memberRoleText}
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                    >
                                      {memberSportRoleByUid[m.uid] || "Player"}
                                    </Text>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                      <Text style={[styles.helperTextTiny, styles.marginTop8]}>
                        {teamPaymentMode === "captain_pays_all"
                          ? `Captain pays for ${reservedSlots} slots now.`
                          : "Captain pays only own slot now. Teammate slots confirm when they are paid/confirmed."}
                      </Text>
                      <View style={[styles.chipRow, styles.marginTop8]}>
                        {(
                          [
                            {
                              key: "captain_pays_all",
                              label: `Captain pays all (${reservedSlots})`,
                            },
                            {
                              key: "captain_pays_self",
                              label: "Captain pays self only",
                            },
                          ] as const
                        ).map((opt) => {
                          const isActive = teamPaymentMode === opt.key;
                          return (
                            <Pressable
                              key={opt.key}
                              style={({ pressed }) => [
                                styles.optionChip,
                                isActive && styles.optionChipActive,
                                pressed && { opacity: 0.9 },
                              ]}
                              onPress={() => setTeamPaymentMode(opt.key)}
                            >
                              <Text
                                style={[
                                  styles.optionChipText,
                                  isActive && styles.optionChipTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Game-Specific Dynamic Fields */}
          <GameDynamicFields
            gameKey={selectedGame}
            formData={formData}
            onChange={(field, value) => {
              setFormData((prev) => ({ ...prev, [field]: value }));
            }}
          />

          {/* Skill Bracket Section (New) */}
          <SkillBracketSection
            gameKey={selectedGame}
            userProfile={userProfile}
            valueScore={hostSkillScore}
            valueTier={hostSkillTier}
            onChange={({ score, tier }) => {
              setHostSkillScore(score);
              setHostSkillTier(tier as any); // Cast if needed
              // Also update older formData field for compatibility if needed
              setFormData((prev) => ({
                ...prev,
                skillLevel: (tier as string) || "Any",
              }));
            }}
          />

          {/* Phase 3: Location Mode Selector */}
          <LocationModeSelector
            locationMode={locationMode}
            onModeChange={setLocationMode}
          />

          {/* Zone Picker (Specific Zone Mode) */}
          {locationMode === "zone" && (
            <>
              <ZonePicker
                gameKey={selectedGame}
                selectedZoneId={selectedZoneId}
                onZoneSelect={(zone) => {
                  setSelectedZoneId(zone.id || null);
                  setSelectedZoneName(zone.venueBrandName || null);
                  setSelectedZone(zone);
                  setSelectedZoneRateKey(null);
                  setZoneRate(0);
                }}
                userPreferredAreas={userProfile?.areasPreferred}
              />

              {selectedZoneId && zoneRateOptions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Select Rate Type
                    <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={styles.chipRow}>
                    {zoneRateOptions.map((opt) => {
                      const isActive = selectedZoneRateKey === opt.key;
                      return (
                        <Pressable
                          key={opt.key}
                          style={({ pressed }) => [
                            styles.optionChip,
                            isActive && styles.optionChipActive,
                            pressed && { opacity: 0.9 },
                          ]}
                          onPress={() => {
                            setSelectedZoneRateKey(opt.key);
                            setZoneRate(opt.price);
                          }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              isActive && styles.optionChipTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {!selectedZoneRateKey && (
                    <Text style={[styles.helperText, styles.marginTop8]}>
                      Pick a rate to calculate per-person pricing.
                    </Text>
                  )}
                </View>
              )}

              {/* Series Type Selector (CS2 & FC & Tekken) */}
              {(selectedGame === "cs2" ||
                selectedGame === "fc26" ||
                selectedGame === "tekken8") &&
                selectedZoneId && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                      Series Type<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={[styles.row, styles.gap8]}>
                      {(selectedGame === "cs2"
                        ? (["BO1", "BO3", "BO5"] as const)
                        : selectedGame === "tekken8"
                          ? (["BO7", "BO20", "BO40"] as const)
                          : (["BO3", "BO5", "BO10"] as const)
                      ).map((type) => (
                        <Pressable
                          key={type}
                          style={({ pressed }) => [
                            styles.optionChip,
                            seriesType === type && styles.optionChipActive,
                            {
                              flex: 1,
                              alignItems: "center",
                              justifyContent: "center",
                            },
                            pressed && { opacity: 0.9 },
                          ]}
                          onPress={() => setSeriesType(type)}
                          android_ripple={{ color: "rgba(255,255,255,0.08)" }}
                        >
                          <Text
                            style={[
                              styles.optionChipText,
                              seriesType === type &&
                              styles.optionChipTextActive,
                            ]}
                          >
                            {type === "BO1"
                              ? "Best of 1"
                              : type === "BO3"
                                ? "Best of 3"
                                : type === "BO5"
                                  ? "Best of 5"
                                  : type === "BO10"
                                    ? "Best of 10"
                                    : type === "BO7"
                                      ? "Best of 7"
                                      : type === "BO20"
                                        ? "Best of 20"
                                        : "Best of 40"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text
                      style={{
                        color: COLORS.muted,
                        fontSize: 12,
                        marginTop: 8,
                      }}
                    >
                      {selectedGame === "cs2"
                        ? `Est.Duration: ${seriesType === "BO1" ? "1 hr" : seriesType === "BO3" ? "3 hrs" : "5 hrs"} `
                        : selectedGame === "tekken8"
                          ? `Booking Duration: ${seriesType === "BO7" ? "1 hr" : seriesType === "BO20" ? "2 hrs" : "3 hrs"} `
                          : `Booking Duration: ${seriesType === "BO3" ? "1 hr" : seriesType === "BO5" ? "2 hrs" : "3 hrs"} `}
                    </Text>
                  </View>
                )}

              {/* Booking Duration Selector (Futsal) */}
              {selectedGame === "futsal" && selectedZoneId && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Booking Duration
                    <Text style={styles.requiredAsterisk}>*</Text>
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[1, 1.5, 2].map((d) => (
                      <Pressable
                        key={d}
                        style={({ pressed }) => [
                          styles.optionChip,
                          duration === d && styles.optionChipActive,
                          {
                            flex: 1,
                            alignItems: "center",
                            justifyContent: "center",
                          },
                          pressed && { opacity: 0.9 },
                        ]}
                        onPress={() => setDuration(d)}
                        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            duration === d && styles.optionChipTextActive,
                          ]}
                        >
                          {d} Hour{d > 1 ? "s" : ""}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.helperText, styles.marginTop8]}>
                    Standard match lengths ensure competitive balance and fair
                    play.
                  </Text>
                </View>
              )}
            </>
          )}

          {/* Phase 3: Broadcast Area Selector */}
          {locationMode === "broadcast" && (
            <BroadcastAreaSelector
              profile={userProfile}
              selectedAreas={broadcastAreas}
              onAreasChange={setBroadcastAreas}
            />
          )}

          {/* Series Type (Padel & Pickleball) */}
          {(selectedGame === "padel" || selectedGame === "pickleball") && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Series Type<Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.chipRow}>
                {["BO3", "BO5", "BO10"].map((series) => {
                  const isActive = formData.seriesType === series;
                  const labels: Record<string, string> = {
                    BO3: "Best of 3",
                    BO5: "Best of 5",
                    BO10: "Best of 10",
                  };
                  return (
                    <TouchableOpacity
                      key={series}
                      style={[
                        styles.optionChip,
                        isActive && styles.optionChipActive,
                      ]}
                      onPress={() => handleFieldChange("seriesType", series)}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          isActive && styles.optionChipTextActive,
                        ]}
                      >
                        {labels[series] || series}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {formData.seriesType && (
                <Text
                  style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}
                >
                  Estimated Hours:{" "}
                  {formData.seriesType === "BO3"
                    ? 1
                    : formData.seriesType === "BO5"
                      ? 2
                      : 3}{" "}
                  hour{formData.seriesType !== "BO3" ? "s" : ""}
                </Text>
              )}
            </View>
          )}

          {/* Price Per Player */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Price Per Player (â‚¨)</Text>
            <View
              style={[
                styles.inputBox,
                { flexDirection: "row", alignItems: "center" },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  { flex: 1 },
                  (selectedGame === "cs2" ||
                    selectedGame === "fc26" ||
                    selectedGame === "tekken8" ||
                    selectedGame === "futsal" ||
                    selectedGame === "indoor_cricket" ||
                    selectedGame === "padel" ||
                    selectedGame === "pickleball") && { color: COLORS.muted },
                ]}
                placeholder="e.g., 500 (or leave empty for free)"
                placeholderTextColor="#757575"
                value={
                  formData.pricePerPlayer ? String(formData.pricePerPlayer) : ""
                }
                onChangeText={(text: string) =>
                  handleFieldChange(
                    "pricePerPlayer",
                    text ? parseInt(text, 10) : "",
                  )
                }
                keyboardType="number-pad"
                editable={
                  selectedGame !== "cs2" &&
                  selectedGame !== "fc26" &&
                  selectedGame !== "tekken8" &&
                  selectedGame !== "futsal" &&
                  selectedGame !== "indoor_cricket" &&
                  selectedGame !== "padel" &&
                  selectedGame !== "pickleball"
                }
              />
              {(selectedGame === "cs2" ||
                selectedGame === "fc26" ||
                selectedGame === "tekken8" ||
                selectedGame === "futsal" ||
                selectedGame === "indoor_cricket" ||
                selectedGame === "padel" ||
                selectedGame === "pickleball") && (
                  <MaterialIcons
                    name="lock"
                    size={16}
                    color={COLORS.muted}
                    style={{ marginLeft: 8 }}
                  />
                )}
            </View>
            {(selectedGame === "futsal" ||
              selectedGame === "indoor_cricket") && (
                <Text
                  style={{
                    color: COLORS.muted,
                    fontSize: 11,
                    marginTop: 4,
                    marginLeft: 4,
                  }}
                >
                  Calculated based on zone rate & duration
                </Text>
              )}
            {(selectedGame === "cs2" ||
              selectedGame === "fc26" ||
              selectedGame === "tekken8" ||
              selectedGame === "padel" ||
              selectedGame === "pickleball") && (
                <>
                  <Text
                    style={{
                      color: COLORS.muted,
                      fontSize: 11,
                      marginTop: 4,
                      marginLeft: 4,
                    }}
                  >
                    Calculated based on zone rate & series type
                    <MaterialIcons
                      name="lock"
                      size={16}
                      color={COLORS.muted}
                      style={styles.marginLeft8}
                    />
                  </Text>
                  <Text
                    style={[
                      styles.helperTextTiny,
                      styles.marginTop4,
                      styles.marginLeft4,
                      { color: COLORS.accent },
                    ]}
                  >
                    Matches at this level are restricted to verified, high-trust
                    players only.
                  </Text>
                  <View
                    style={[
                      styles.infoBox,
                      {
                        marginTop: 8,
                        marginBottom: 8,
                        backgroundColor: COLORS.accent + "10",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.infoBoxText,
                        { color: COLORS.text, fontSize: 13 },
                      ]}
                    >
                      <MaterialIcons
                        name="verified-user"
                        size={16}
                        color={COLORS.accent}
                      />
                      {"\u00A0"}CS2 competitive lobbies require{" "}
                      <Text style={{ fontWeight: "bold" }}>Prime Status</Text> or
                      a verified{" "}
                      <Text style={{ fontWeight: "bold" }}>FACEIT</Text> profile.
                    </Text>
                  </View>
                </>
              )}
          </View>

          {/* Submit Summary */}
          <View style={styles.submitSummaryWrapper}>
            {/* CS2 Summary Line */}
            {selectedGame === "cs2" && formData.format && (
              <View
                style={{
                  ...styles.summaryCard,
                  backgroundColor: "rgba(66, 165, 245, 0.1)",
                  borderColor: "rgba(66, 165, 245, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 13,
                    fontFamily: FONTS.interMedium,
                    lineHeight: 18,
                  }}
                >
                  {"Hosting CS2 5v5 in "}
                  <Text style={{ color: COLORS.accent }}>
                    {locationMode === "broadcast"
                      ? `${broadcastAreas.length > 0 ? broadcastAreas.join(", ") : userProfile?.areasPreferred?.join(", ") || "preferred areas"} `
                      : selectedZoneName || "selected zone"}
                  </Text>
                  {" Â· "}
                  <Text style={{ color: COLORS.accent }}>
                    {hostSkillTier || formData.skillLevel || "Any skill"}
                  </Text>
                  {formData.selectedMaps &&
                    formData.selectedMaps.length > 0 && (
                      <>
                        {" Â· "}
                        <Text style={{ color: COLORS.accent }}>
                          {formData.selectedMaps.join(", ")}
                        </Text>
                      </>
                    )}
                </Text>
              </View>
            )}

            {/* Tekken 8 Summary Line */}
            {selectedGame === "tekken8" && formData.format && (
              <View
                style={{
                  ...styles.summaryCard,
                  backgroundColor: "rgba(244, 143, 177, 0.08)",
                  borderColor: "rgba(244, 143, 177, 0.3)",
                }}
              >
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 13,
                    fontFamily: FONTS.interMedium,
                    lineHeight: 18,
                  }}
                >
                  {"Hosting Tekken 8 "}
                  <Text style={{ color: COLORS.accent }}>
                    {formData.format || "1v1"}
                  </Text>
                  {" in "}
                  <Text style={{ color: COLORS.accent }}>
                    {locationMode === "broadcast"
                      ? broadcastAreas.length > 0
                        ? broadcastAreas.join(", ")
                        : userProfile?.areasPreferred?.join(", ") ||
                        "preferred areas"
                      : selectedZoneName || "selected zone"}
                  </Text>
                  {" Â· "}
                  <Text style={{ color: COLORS.accent }}>
                    {hostSkillTier || formData.skillLevel || "Any bracket"}
                  </Text>
                  {Array.isArray(formData.tekkenCharacters) &&
                    formData.tekkenCharacters.length > 0 && (
                      <>
                        {" Â· "}
                        <Text style={{ color: COLORS.accent }}>
                          {formData.tekkenCharacters.join(", ")}
                        </Text>
                      </>
                    )}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
      {selectedGame ? (
        <View style={[styles.buttonWrapper, { marginBottom: ctaBottomGuard }]}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || submitting) && styles.primaryButtonDisabled,
              pressed &&
              canSubmit &&
              !submitting &&
              styles.primaryButtonPressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              if (!canSubmit) {
                Alert.alert(
                  "Complete Required Fields",
                  submitBlockers[0] || "Please complete required fields.",
                );
                return;
              }
              if (!validateForm()) return;
              handleSubmit();
            }}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {locationMode === "broadcast"
                  ? "Send Broadcast"
                  : "Create Matchroom"}
              </Text>
            )}
          </Pressable>
          {!canSubmit && (
            <Text style={[styles.helperTextTiny, styles.submitHintText]}>
              Complete required fields: {submitBlockers[0]}
            </Text>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
