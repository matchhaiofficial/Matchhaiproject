import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import BottomActionBar from "../../../src/components/BottomActionBar";
import {
  AppDialog,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import GameActivationPromptModal from "../../../src/components/GameActivationPromptModal";
import Screen from "../../../src/components/Screen";
import SkillAssessmentModal from "../../../src/components/SkillAssessmentModal";
import { useAuth } from "../../../src/context/AuthContext";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { useEntrance } from "../../../src/motion/useEntrance";
import { usePressScale } from "../../../src/motion/usePressScale";
 
import {
  type PricingRule,
} from "../../../src/services/pricingRuleService";
import { SkillTier } from "../../../src/services/skillRatingService";
import type { Team } from "../../../src/services/convex/teamService";
import {
  getUserTeamsForGame,
} from "../../../src/services/convex/teamService";
import type { UserProfile } from "../../../src/services/userService";
import {
  getUserProfile,
  getUserSportRoleLabel,
} from "../../../src/services/userService";
import { getZoneById, type Zone } from "../../../src/services/convex/zoneService";
import { Id } from "../../../convex/_generated/dataModel";
import { COLORS, FONTS } from "../../../src/theme";
import { isUserFullyVerified, showKycVerificationRequiredAlert } from "../../../src/utils/verificationGate";
import { isPhysicalGameDisabled } from "../../../constants/gameAvailability";
import { normalizeValorantRole } from "../../../constants/profileOptions";

import Logger from "../../../src/utils/logger";
import { PAYMENT_VERIFICATION_SAFE_MESSAGE } from "../../../src/utils/paymentUiCopy";
import BasicFields from "./components/BasicFields";
import BroadcastAreaSelector from "./components/BroadcastAreaSelector";
import GameDynamicFields from "./components/GameDynamicFields";
import GameSelector from "./components/GameSelector";
import LocationModeSelector from "./components/LocationModeSelector";
import RoleAutoFill from "./components/RoleAutoFill";
import SkillBracketSection from "./components/SkillBracketSection";
import TeamBookingSection from "./components/TeamBookingSection";
import WalkInRosterEditor from "./components/WalkInRosterEditor";
import {
  useMatchroomCreatePricing,
  type ZoneRateOption,
} from "./hooks/useMatchroomCreatePricing";
import {
  useMatchroomCreateSubmitFlow,
  type MatchroomCreateSubmitFeedback,
} from "./hooks/useMatchroomCreateSubmitFlow";
import { useMatchroomCreateTeamBooking } from "./hooks/useMatchroomCreateTeamBooking";
import { useMatchroomCreateBroadcastAreas } from "./hooks/useMatchroomCreateBroadcastAreas";
import {
  useMatchroomCreateWalkInRoster,
} from "./hooks/useMatchroomCreateWalkInRoster";
import {
  getMatchroomCreateSubmitBlockers,
  getMatchroomCreateValidationError,
} from "./utils/matchroomCreateValidation";
// import TeamModeSelector from './components/TeamModeSelector';
// import TeamPicker from './components/TeamPicker';
// import SlotReservation from './components/SlotReservation';
import { MotionPressable } from "./components/MotionPressable";
import ZonePicker from "./components/ZonePicker";
import styles from "./create.styles";

const ZONE_GAME_SUPPORT_MAP: Array<{ gameKey: string; flags: string[] }> = [
  { gameKey: "cs2", flags: ["supportsCs2"] },
  { gameKey: "cs16", flags: ["supportsCs16"] },
  { gameKey: "valorant", flags: ["supportsValorant"] },
  { gameKey: "fc26", flags: ["supportsFc25", "supportsFc26"] },
  { gameKey: "tekken8", flags: ["supportsTekken8"] },
  // Physical sports are temporarily disabled.
  // { gameKey: "futsal", flags: ["supportsFutsal"] },
  // { gameKey: "indoor_cricket", flags: ["supportsIndoorCricket"] },
  // { gameKey: "padel", flags: ["supportsPadel"] },
  // { gameKey: "pickleball", flags: ["supportsPickleball"] },
];

const getSupportedGameKeysFromZoneGames = (zoneGames: any): string[] => {
  if (!zoneGames || typeof zoneGames !== "object") return [];
  return ZONE_GAME_SUPPORT_MAP.filter(({ flags }) =>
    flags.some((flag) => zoneGames?.[flag] === true),
  )
    .map(({ gameKey }) => gameKey)
    .filter((gameKey) => !isPhysicalGameDisabled(gameKey));
};

const parseSupportedGamesParam = (value: unknown): string[] | undefined => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return undefined;

    const games = parsed
      .filter((gameKey): gameKey is string => typeof gameKey === "string")
      .map((gameKey) => (gameKey === "fc25" ? "fc26" : gameKey))
      .filter((gameKey) => !isPhysicalGameDisabled(gameKey));

    return Array.from(new Set(games));
  } catch (error) {
    Logger.error("CreateMatchroom", "Error parsing zoneSupportedGames", error);
    return undefined;
  }
};

const WALKIN_SERIES_OPTIONS = ["BO1", "BO3", "BO5"] as const;
type WalkInSeriesType = (typeof WALKIN_SERIES_OPTIONS)[number];

const isCsStyleGame = (gameKey: string | null | undefined) =>
  gameKey === "cs2" || gameKey === "cs16" || gameKey === "valorant";

const getWalkInDurationMinutes = (
  gameKey: string | null,
  series: WalkInSeriesType,
  overs?: string,
) => {
  if (isCsStyleGame(gameKey)) {
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

const toPositiveNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatCategoryLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatCurrency = (value: number) => `Rs ${Math.round(value)}`;

export default function CreateMatchroom() {
  useRouteLogger("CreateMatchroomScreen");
  const { user, authUser } = useAuth();
  const { showToast } = useToast();
  const { zone: adminZone } = useZoneData();
  const params = useLocalSearchParams<{
    zoneId?: string;
    zoneName?: string;
    zoneSupportedGames?: string;
    mode?: string;
    branchId?: string;
  }>();
  const isZoneWalkInAdmin = params.mode === "zone_walkin_admin";
  const venueAllowedGameKeys = useMemo(
    () => parseSupportedGamesParam(params.zoneSupportedGames),
    [params.zoneSupportedGames],
  );
  const isVenueDirectBooking = !isZoneWalkInAdmin && Boolean(params.zoneId && venueAllowedGameKeys);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<MatchroomCreateSubmitFeedback | null>(null);
  const lastInvalidScheduleToastKeyRef = useRef<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const { animatedStyle: contentEntranceStyle } = useEntrance({
    visible: Boolean(selectedGame),
    distance: 18,
  });
  const {
    animatedStyle: submitMotionStyle,
    onPressIn: onSubmitPressIn,
    onPressOut: onSubmitPressOut,
  } = usePressScale();
  const [titleTouched, setTitleTouched] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hostRole, setHostRole] = useState<string | null>(null);

  // Skill System State
  const [hostSkillScore, setHostSkillScore] = useState<number | null>(null);
  const [hostSkillTier, setHostSkillTier] = useState<SkillTier | null>(null);
  const [hostSkillAnswers, setHostSkillAnswers] = useState<Record<string, any>>(
    {},
  );

  const [teams, setTeams] = useState<Team[]>([]);

  // Phase 3: Location Mode State
  const [locationMode, setLocationMode] = useState<"zone" | "broadcast">(
    "zone",
  );

  // Phase 3: Zone Selection State (pre-fill from params if coming from venue)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    params.zoneId || null,
  );
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(
    params.zoneName || null,
  );
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const emailVerificationLocked =
    !isZoneWalkInAdmin && !isUserFullyVerified(authUser, user);
  // Phase 4: CS2 & FC25/26 Specific State
  const [seriesType, setSeriesType] = useState<
    "BO1" | "BO3" | "BO5" | "BO10" | "BO7" | "BO20" | "BO40"
  >("BO1");
  const [duration, setDuration] = useState<number>(1); // Duration in hours (for Futsal)
  const [walkInPaymentMode, setWalkInPaymentMode] = useState<
    "venue_pay" | "guest_pay"
  >("venue_pay");
  const [walkInBranchId, setWalkInBranchId] = useState<string | null>(
    typeof params.branchId === "string" && params.branchId.trim().length
      ? params.branchId
      : null,
  );

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

  const {
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
  } = useMatchroomCreateTeamBooking({
    selectedGame,
    setTeams,
    teams,
    userId: user?._id,
    userProfile,
  });

  const {
    zonePricingRules,
    zoneRate,
    zoneRateOptions,
    selectedZoneRateKey,
    setZoneRate,
    setSelectedZoneRateKey,
    selectZoneRateOption,
    resetZoneRateSelection,
  } = useMatchroomCreatePricing({
    selectedZoneId,
    selectedZone,
    selectedBranchId: walkInBranchId || (typeof params.branchId === "string" ? params.branchId : null),
    selectedGame,
    seriesType,
    duration,
    formData,
    isZoneWalkInAdmin,
    setFormData,
  });

  const {
    availableAreas: availableBroadcastAreas,
    loading: loadingBroadcastAreas,
    preferredAreas: preferredBroadcastAreas,
    selectedAreas: broadcastAreas,
    toggleArea: toggleBroadcastArea,
  } = useMatchroomCreateBroadcastAreas({
    locationMode,
    selectedGame,
    userProfile,
  });

  const {
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
  } = useMatchroomCreateWalkInRoster({
    format: formData.format,
    isZoneWalkInAdmin,
    maxPlayers: formData.maxPlayers,
    selectedGame,
  });

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


  useEffect(() => {
    if (!isZoneWalkInAdmin) return;
    if (!adminZone?.id) return;

    setLocationMode((prev) => (prev === "zone" ? prev : "zone"));
    setSelectedZoneId((prev) => (prev === adminZone.id ? prev : adminZone.id));
    setSelectedZoneName((prev) => {
      const nextName = adminZone.venueBrandName || null;
      return prev === nextName ? prev : nextName;
    });
    setSelectedZone((prev) => {
      const prevId = String((prev as any)?.id || (prev as any)?._id || "");
      return prevId === String(adminZone.id) ? prev : (adminZone as Zone);
    });
  }, [adminZone?.id, adminZone?.venueBrandName, isZoneWalkInAdmin]);

  useEffect(() => {
    if (!isVenueDirectBooking) return;
    setLocationMode("zone");
  }, [isVenueDirectBooking]);

  useEffect(() => {
    if (isZoneWalkInAdmin) return;
    if (!selectedZoneId) {
      setSelectedZone(null);
      return;
    }

    let cancelled = false;
    const loadSelectedZone = async () => {
      const res = await getZoneById(selectedZoneId);
      if (!cancelled && res.ok && res.data) {
        setSelectedZone(res.data);
        setSelectedZoneName(res.data.venueBrandName || params.zoneName || null);
      }
    };

    loadSelectedZone();
    return () => {
      cancelled = true;
    };
  }, [isZoneWalkInAdmin, params.zoneName, selectedZoneId]);

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


  useFocusEffect(
    useCallback(() => {
      if (selectedTeamId) {
        refreshSelectedTeam(selectedTeamId);
      }
    }, [selectedTeamId, refreshSelectedTeam]),
  );

  const minAllowedDate = useMemo(() => {
    const d = new Date();
    if (isZoneWalkInAdmin) {
      // Walk-in: at least 1 day ahead (no same-day) — earliest selectable day is tomorrow.
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1);
      return d;
    }
    // Solo player matchroom: at least 3 days in advance.
    d.setMinutes(0, 0, 0);
    d.setDate(d.getDate() + 3);
    return d;
  }, [isZoneWalkInAdmin]);
  const minAllowedDateLabel = useMemo(
    () =>
      isZoneWalkInAdmin
        ? minAllowedDate.toLocaleDateString()
        : `${minAllowedDate.toLocaleDateString()} at ${minAllowedDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}`,
    [isZoneWalkInAdmin, minAllowedDate],
  );

  const isDateAllowed = useMemo(() => {
    if (!formData.date) return false;
    const dateObj = new Date(`${formData.date}T00:00`);
    if (isNaN(dateObj.getTime())) return false;
    if (isZoneWalkInAdmin) {
      return dateObj.getTime() >= minAllowedDate.getTime();
    }
    if (!formData.time) {
      const minDay = new Date(minAllowedDate);
      minDay.setHours(0, 0, 0, 0);
      return dateObj.getTime() >= minDay.getTime();
    }
    const scheduledStart = new Date(`${formData.date}T${formData.time}`);
    if (isNaN(scheduledStart.getTime())) return false;
    return scheduledStart.getTime() >= minAllowedDate.getTime();
  }, [formData.date, formData.time, isZoneWalkInAdmin, minAllowedDate]);

  useEffect(() => {
    if (isZoneWalkInAdmin) {
      lastInvalidScheduleToastKeyRef.current = null;
      return;
    }
    if (!formData.date || !formData.time) {
      lastInvalidScheduleToastKeyRef.current = null;
      return;
    }
    if (isDateAllowed) {
      lastInvalidScheduleToastKeyRef.current = null;
      return;
    }
    const invalidScheduleKey = `${formData.date}|${formData.time}`;
    if (lastInvalidScheduleToastKeyRef.current !== invalidScheduleKey) {
      lastInvalidScheduleToastKeyRef.current = invalidScheduleKey;
      showToast({
        message: "You can only create a matchroom after 3 full days (72 hours).",
        title: "Date too soon",
        type: "warning",
      });
    }
    setFormData((prev) => ({ ...prev, date: "" }));
  }, [formData.date, formData.time, isDateAllowed, isZoneWalkInAdmin, showToast]);

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
    if (!userProfile || !venueAllowedGameKeys) return;

    const zoneSupportedGames = venueAllowedGameKeys;
    if (zoneSupportedGames.length === 0) return;

    // Game labels for display
    const gameLabels: Record<string, string> = {
      cs2: "CS2",
      cs16: "CS 1.6",
      valorant: "Valorant",
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
      cs16: "playsCs16" as keyof typeof userProfile,
      valorant: "playsValorant" as keyof typeof userProfile,
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
  }, [isZoneWalkInAdmin, userProfile, venueAllowedGameKeys]);

  const loadUserProfile = async () => {
    if (!user?._id) {
      setLoading(false);
      return;
    }

    try {
      const result = await getUserProfile(user._id);
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
    if (isPhysicalGameDisabled(gameKey)) return;

    setSelectedGame(gameKey);

    // Auto-initialize hostRole from profile
    if (userProfile) {
      const role = getUserSportRoleLabel(userProfile, gameKey);
      if (role) {
        setHostRole(role);
      } else {
        setHostRole(null);
      }
    }

    // Auto-Initialize Skill Score if missing
    // Skill initialization is handled by SkillBracketSection; avoid side-effect writes here

    // Reset game-specific fields when changing game
    setFormData((prev) => ({
      ...prev,
      // Reset game-specific fields to defaults
      format: "",
      maxPlayers: 10,
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
      const result = await getUserTeamsForGame(user._id, gameKey as any);
      if (result.ok && result.data) {
        setTeams(result.data);
        resetTeamBookingState();
      }
    } else if (isZoneWalkInAdmin) {
      setTeams([]);
      resetTeamBookingState();
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
      if (isZoneWalkInAdmin) {
        resetWalkInRoster();
      }
      // Initialize host role from profile
      if (userProfile?.cs2Role) {
        setHostRole(userProfile.cs2Role);
      } else {
        setHostRole(null);
      }
    } else if (gameKey === "cs16") {
      const skillTier = userProfile?.skillScores?.cs16?.tier || "Any";
      setFormData((prev) => ({
        ...prev,
        title: "5v5 Competitive",
        format: "5v5",
        maxPlayers: 10,
        skillLevel: skillTier,
      }));
      setSeriesType("BO1");
      if (isZoneWalkInAdmin) {
        resetWalkInRoster();
      }
      setHostRole((userProfile as any)?.cs16Role || null);
    } else if (gameKey === "valorant") {
      const skillTier = userProfile?.skillScores?.valorant?.tier || "Any";
      setFormData((prev) => ({
        ...prev,
        title: "5v5 Competitive",
        format: "5v5",
        maxPlayers: 10,
        skillLevel: skillTier,
      }));
      setSeriesType("BO1");
      if (isZoneWalkInAdmin) {
        resetWalkInRoster();
      }
      setHostSkillTier(skillTier as SkillTier);
      setHostSkillScore(userProfile?.skillScores?.valorant?.rating ?? null);
      setHostRole(normalizeValorantRole((userProfile as any)?.valorantRole));
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

  const validationParams = useMemo(
    () => ({
      adminBranchesCount: adminBranches.length,
      broadcastAreasCount: broadcastAreas.length,
      canUseCaptainBooking,
      formData: {
        date: formData.date,
        format: formData.format,
        maxPlayers: formData.maxPlayers,
        time: formData.time,
        title: formData.title,
      },
      isCaptainForGame,
      isDateAllowed,
      isZoneWalkInAdmin,
      locationMode,
      minAllowedDateLabel,
      reservedSlots,
      selectedGame,
      selectedTeamId,
      selectedTeamMemberCount: selectedTeamMemberUids.length,
      selectedZoneId,
      selectedZoneRateKey,
      seriesType,
      teamMode,
      userAreaPreferenceCount: userProfile?.areasPreferred?.length || 0,
      walkInBranchId,
      walkInSeatCount,
      walkInSeatPlayers,
      walkInTeamACaptainSeatNumber,
      walkInTeamBCaptainSeatNumber,
      zoneIdAvailableForWalkIn: !!adminZone?.id,
      zoneRateOptionsCount: zoneRateOptions.length,
    }),
    [
      adminBranches.length,
      adminZone?.id,
      broadcastAreas.length,
      canUseCaptainBooking,
      formData.date,
      formData.format,
      formData.maxPlayers,
      formData.time,
      formData.title,
      isCaptainForGame,
      isDateAllowed,
      isZoneWalkInAdmin,
      locationMode,
      minAllowedDateLabel,
      reservedSlots,
      selectedGame,
      selectedTeamId,
      selectedTeamMemberUids.length,
      selectedZoneId,
      selectedZoneRateKey,
      seriesType,
      teamMode,
      userProfile?.areasPreferred,
      walkInBranchId,
      walkInSeatCount,
      walkInSeatPlayers,
      walkInTeamACaptainSeatNumber,
      walkInTeamBCaptainSeatNumber,
      zoneRateOptions.length,
    ],
  );

  const validateForm = () => {
    const validationError = getMatchroomCreateValidationError(validationParams);
    if (!validationError) return true;

    Logger.debug("CreateMatchroom", "Validation blocked submit", {
      reason: validationError.reason,
    });
    showToast({
      message: validationError.message,
      title: validationError.title,
      type: "warning",
    });
    return false;
  };

  const submitBlockers = useMemo(
    () => getMatchroomCreateSubmitBlockers(validationParams),
    [validationParams],
  );

  const canSubmit = submitBlockers.length === 0;
  const captainSeatsPaid =
    teamMode === "team"
      ? teamPaymentMode === "captain_pays_all"
        ? reservedSlots
        : 1
      : 1;
  const effectivePriceValue = Math.ceil(
    Number(formData.pricePerPlayer || 0) * (teamMode === "team" && teamPaymentMode === "captain_pays_all" ? reservedSlots : 1),
  );
  const effectivePriceLabel =
    teamMode === "team" && teamPaymentMode === "captain_pays_all"
      ? "Total Amount Due (PKR)"
      : "Price Per Player (PKR)";
  const selectedZoneRateOption =
    zoneRateOptions.find((option) => option.key === selectedZoneRateKey) || null;
  const {
    activating,
    activeEasypaisaOrderRef,
    closeActivationPrompt,
    closeAssessment,
    closeEasypaisaPhonePrompt,
    completeAssessment,
    confirmEasypaisaPayment,
    confirmActivation,
    continueEasypaisaPayment,
    hideEasypaisaPhonePrompt,
    easypaisaCheckoutPhone,
    easypaisaCheckoutStatus,
    easypaisaPaymentAmount,
    easypaisaPaymentPhase,
    finalizedEasypaisaMatchroomId,
    handleEasypaisaPhoneChange,
    handleSubmit,
    openFinalizedEasypaisaMatchroom,
    openEasypaisaPhonePrompt,
    refreshingEasypaisaStatus,
    resetEasypaisaPaymentPrompt,
    showEasypaisaPhonePrompt,
    showActivationPrompt,
    showAssessment,
    startingEasypaisaPayment,
  } = useMatchroomCreateSubmitFlow({
    adminBranches,
    adminZone,
    authUser,
    broadcastAreas,
    captainSeatsPaid,
    duration,
    effectivePriceValue,
    formData,
    hostRole,
    hostSkillAnswers,
    hostSkillScore,
    hostSkillTier,
    isZoneWalkInAdmin,
    locationMode,
    memberSportRoleByUid,
    resolvedTeam,
    reservedSlots,
    selectedAdminBranch,
    selectedBranchId:
      walkInBranchId || (typeof params.branchId === "string" ? params.branchId : null),
    selectedGame,
    selectedTeamId,
    selectedTeamMemberUids,
    selectedZoneId,
    selectedZoneRateKey,
    selectedZoneRateResourceContext: selectedZoneRateOption?.resourceContext || null,
    selectedZoneName,
    selectableTeamMembers,
    seriesType,
    setSubmitFeedback,
    setFormData,
    setHostSkillScore,
    setHostSkillTier,
    setSubmitting,
    setUserProfile,
    teamMode,
    teamPaymentMode,
    teams,
    user,
    userProfile,
    walkInBranchId,
    walkInPaymentMode,
    walkInSeatCount,
    walkInSeatPlayers,
    walkInTeamACaptainSeatNumber,
    walkInTeamBCaptainSeatNumber,
  });
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
  const submitFeedbackColor =
    submitFeedback?.type === "success"
      ? COLORS.success
      : submitFeedback?.type === "error"
        ? COLORS.error
        : COLORS.warning;
  const isEasypaisaPaymentActive = Boolean(activeEasypaisaOrderRef);
  const isEasypaisaFinalized = easypaisaPaymentPhase === "finalized" && Boolean(finalizedEasypaisaMatchroomId);
  const isEasypaisaPaymentConfirmed =
    easypaisaPaymentPhase === "confirmed" ||
    easypaisaPaymentPhase === "completing" ||
    easypaisaPaymentPhase === "completion_failed" ||
    isEasypaisaFinalized;
  const showEasypaisaRecoveryBanner =
    isEasypaisaPaymentActive && !showEasypaisaPhonePrompt;
  const isEasypaisaPaymentLocked =
    startingEasypaisaPayment ||
    easypaisaPaymentPhase === "payment_sent" ||
    easypaisaPaymentPhase === "confirmed" ||
    easypaisaPaymentPhase === "completing" ||
    easypaisaPaymentPhase === "completion_failed" ||
    easypaisaPaymentPhase === "finalized";
  const easypaisaDialogTitle = isEasypaisaPaymentActive
    ? isEasypaisaFinalized
      ? "Matchroom created"
      : easypaisaPaymentPhase === "completion_failed"
      ? "Payment received"
      : easypaisaPaymentPhase === "failed"
        ? "Payment not completed"
      : easypaisaPaymentPhase === "expired"
        ? "Payment not completed"
        : easypaisaPaymentPhase === "confirmed" || easypaisaPaymentPhase === "completing"
          ? "Payment confirmed"
          : "Payment pending"
    : "Confirm Easypaisa Number";
  const easypaisaDialogSubtitle = isEasypaisaPaymentActive
    ? isEasypaisaFinalized
      ? "Your payment was received and your matchroom is ready."
      : easypaisaPaymentPhase === "confirmed" || easypaisaPaymentPhase === "completing"
      ? "MatchHai is finishing your matchroom."
      : easypaisaPaymentPhase === "completion_failed"
        ? "Your payment was received, but MatchHai could not finish the matchroom yet."
      : easypaisaPaymentPhase === "failed" || easypaisaPaymentPhase === "expired"
        ? "This payment was not completed. You can try again when ready."
      : "Approve the payment in Easypaisa. MatchHai will keep checking this screen."
    : "Use the number you want to pay with for this matchroom payment.";
  const easypaisaStartTimedOut = String(easypaisaCheckoutStatus?.lastError || "")
    .toLowerCase()
    .includes("taking too long");
  const easypaisaStatusMessage =
    isEasypaisaFinalized
      ? "Your payment was received and your matchroom is ready."
      : easypaisaPaymentPhase === "confirmed"
      ? "MatchHai is finishing your matchroom."
      : easypaisaPaymentPhase === "completing"
        ? "MatchHai is finishing your matchroom."
        : easypaisaPaymentPhase === "completion_failed"
          ? "Your payment was received, but MatchHai could not finish the matchroom yet. Please retry or contact support with this order number."
        : easypaisaPaymentPhase === "failed"
          ? "Easypaisa did not complete this payment. You can try again with the same or another number."
          : easypaisaPaymentPhase === "expired"
            ? "This Easypaisa payment session expired before confirmation."
            : easypaisaStartTimedOut
              ? "Easypaisa is slow to reply, but the prompt may still be waiting on your phone. Approve it there, then refresh this status."
              : startingEasypaisaPayment && !activeEasypaisaOrderRef
                ? "Sending the Easypaisa request to your mobile account..."
              : "Payment request sent. Approve it in your Easypaisa app or mobile account prompt.";
  const easypaisaStatusIcon =
    isEasypaisaFinalized
      ? "check-circle"
      : easypaisaPaymentPhase === "confirmed" || easypaisaPaymentPhase === "completing"
      ? "check-circle"
      : easypaisaPaymentPhase === "completion_failed"
        ? "hourglass-top"
        : easypaisaPaymentPhase === "failed" || easypaisaPaymentPhase === "expired"
        ? "error"
        : "hourglass-top";
  const easypaisaStatusColor =
    isEasypaisaFinalized
      ? COLORS.success
      : easypaisaPaymentPhase === "confirmed" || easypaisaPaymentPhase === "completing"
      ? COLORS.success
      : easypaisaPaymentPhase === "completion_failed"
        ? COLORS.warning
        : easypaisaPaymentPhase === "failed" || easypaisaPaymentPhase === "expired"
        ? COLORS.error
        : COLORS.warning;
  const easypaisaRecoveryStatusLabel =
    isEasypaisaFinalized
      ? "Matchroom created"
      : easypaisaPaymentPhase === "confirmed"
      ? "Payment confirmed"
      : easypaisaPaymentPhase === "completing"
        ? "Completing matchroom"
        : easypaisaPaymentPhase === "completion_failed"
          ? "Completion pending"
          : easypaisaPaymentPhase === "failed"
            ? "Payment not completed"
            : easypaisaPaymentPhase === "expired"
              ? "Payment expired"
              : "Payment pending";
  const showEasypaisaUnverifiedStatus =
    easypaisaPaymentPhase === "payment_sent" &&
    Boolean(easypaisaCheckoutStatus?.providerDescription);
  const shouldHideSubmitFeedbackForConfirmedPayment =
    isEasypaisaPaymentActive && isEasypaisaPaymentConfirmed;
  const renderEasypaisaRecoveryBanner = () => {
    if (!showEasypaisaRecoveryBanner) return null;

    return (
      <View
        style={{
          gap: 14,
          marginHorizontal: 16,
          marginBottom: 20,
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.cardBorder,
          backgroundColor: COLORS.cardBackground,
        }}
      >
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <AppIcon name={easypaisaStatusIcon as any} size={20} color={easypaisaStatusColor} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                color: COLORS.text,
                fontFamily: FONTS.interSemiBold,
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              {easypaisaRecoveryStatusLabel}
            </Text>
            <Text
              style={{
                color: COLORS.textSecondary,
                fontFamily: FONTS.body,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {easypaisaStatusMessage}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {!isEasypaisaFinalized ? (
            <AppButton
              variant="secondary"
              style={{ flex: 1 }}
              onPress={openEasypaisaPhonePrompt}
            >
              Open payment status
            </AppButton>
          ) : null}
          {easypaisaPaymentPhase === "payment_sent" ? (
            <AppButton
              style={{ flex: 1 }}
              onPress={() => void continueEasypaisaPayment()}
              loading={refreshingEasypaisaStatus}
              disabled={refreshingEasypaisaStatus}
            >
              I've paid / Refresh
            </AppButton>
          ) : isEasypaisaFinalized ? (
            <AppButton style={{ flex: 1 }} onPress={openFinalizedEasypaisaMatchroom}>
              Open matchroom
            </AppButton>
          ) : easypaisaPaymentPhase === "completion_failed" ? (
            <AppButton
              style={{ flex: 1 }}
              onPress={() => void continueEasypaisaPayment()}
              loading={refreshingEasypaisaStatus}
              disabled={refreshingEasypaisaStatus}
            >
              Retry finishing
            </AppButton>
          ) : null}
        </View>
      </View>
    );
  };
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
        scroll={false}
        keyboardAvoiding
        contentStyle={styles.createNonScrollContent}
      >
        <AppHeader
          title="Create Matchroom"
          subtitle="Walk-in mode for zone admin"
          onBack={() => router.back()}
          inlineTitle
        />

        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
        >
          <GameSelector
            selectedGame={selectedGame}
            onSelectGame={handleGameSelect}
            userProfile={userProfile}
            allowAllGames
            allowedGameKeys={walkInSupportedGameKeys}
          />

        {selectedGame ? (
          <>
            <BasicFields
              formData={formData}
              onChange={handleFieldChange}
              selectedGame={selectedGame || undefined}
              minimumDate={minAllowedDate}
              dateHelperText="Walk-in matchrooms must be scheduled at least 1 day in advance."
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
                          selectZoneRateOption(opt.key, opt.price);
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

            <WalkInRosterEditor
              onSeatCountChange={handleWalkInSeatCountChange}
              onSelectCaptain={setWalkInCaptainSeat}
              onUpdatePlayerField={(seatNumber, field, value) =>
                updateWalkInSeatPlayer(seatNumber, { [field]: value })
              }
              selectedGame={selectedGame}
              walkInBookedSeatCount={walkInBookedSeatCount}
              walkInMaxSeatLimit={walkInMaxSeatLimit}
              walkInSeatCount={walkInSeatCount}
              walkInSeatPlayers={walkInSeatPlayers}
              walkInTeamACaptainSeatNumber={walkInTeamACaptainSeatNumber}
              walkInTeamBCaptainSeatNumber={walkInTeamBCaptainSeatNumber}
            />

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

          </>
        ) : null}
        {renderEasypaisaRecoveryBanner()}
        </Animated.ScrollView>

        {selectedGame ? (
          <BottomActionBar>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (!isEasypaisaPaymentActive && (!canSubmit || submitting || emailVerificationLocked)) &&
                    styles.primaryButtonDisabled,
                  pressed &&
                  (isEasypaisaPaymentActive || canSubmit) &&
                  !submitting &&
                  !emailVerificationLocked &&
                  styles.primaryButtonPressed,
                ]}
                onPress={() => {
                  if (isEasypaisaPaymentActive) {
                    if (isEasypaisaFinalized) {
                      openFinalizedEasypaisaMatchroom();
                      return;
                    }
                    openEasypaisaPhonePrompt();
                    return;
                  }
                  setSubmitFeedback(null);
                  if (emailVerificationLocked) {
                    showKycVerificationRequiredAlert();
                    return;
                  }
                  if (!validateForm()) return;
                  handleSubmit();
                }}
                disabled={submitting && !isEasypaisaPaymentActive}
              >
                {submitting && !isEasypaisaPaymentActive ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isEasypaisaFinalized
                      ? "Open Matchroom"
                      : isEasypaisaPaymentActive
                        ? "Open Payment Status"
                        : "Create Walk-in Matchroom"}
                  </Text>
                )}
              </Pressable>
              {!canSubmit && (
                <Text style={[styles.helperTextTiny, styles.submitHintText]}>
                  Complete required fields: {submitBlockers[0]}
                </Text>
              )}
              {submitFeedback && !shouldHideSubmitFeedbackForConfirmedPayment ? (
                <Text
                  style={[
                    styles.helperTextTiny,
                    styles.submitFeedbackText,
                    { color: submitFeedbackColor },
                  ]}
                >
                  {submitFeedback.title}: {submitFeedback.message}
                </Text>
              ) : null}
          </BottomActionBar>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      keyboardAvoiding
      contentStyle={styles.createNonScrollContent}
    >
      <AppHeader
        title="Create Matchroom"
        subtitle="Set up your match and invite players"
        onBack={() => router.back()}
        inlineTitle
      />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {/* Game Selector */}
        <GameSelector
          selectedGame={selectedGame}
          onSelectGame={handleGameSelect}
          userProfile={userProfile}
          allowedGameKeys={venueAllowedGameKeys}
        />

      {selectedGame && (
        <Animated.View style={contentEntranceStyle}>
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
            dateHelperText="Matchrooms must be scheduled at least 3 days in advance."
          />

          <TeamBookingSection
            canUseCaptainBooking={canUseCaptainBooking}
            captainedTeams={captainedTeams}
            isCaptainForGame={isCaptainForGame}
            memberSportRoleByUid={memberSportRoleByUid}
            onModeChange={setBookingMode}
            onReservedSlotsChange={setReservedSlotsCount}
            onSelectTeam={setSelectedTeamId}
            onTeamPaymentModeChange={setTeamPaymentMode}
            onToggleSelectedTeamMember={toggleSelectedTeamMember}
            reservedSlots={reservedSlots}
            resolvedTeam={resolvedTeam}
            selectableTeamMembers={selectableTeamMembers}
            selectedTeamId={selectedTeamId}
            selectedTeamMemberUids={selectedTeamMemberUids}
            teamMode={teamMode}
            teamPaymentMode={teamPaymentMode}
          />

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
          {!isVenueDirectBooking ? (
            <LocationModeSelector
              locationMode={locationMode}
              onModeChange={setLocationMode}
            />
          ) : null}

          {/* Zone Picker (Specific Zone Mode) */}
          {locationMode === "zone" && (
            <>
              <ZonePicker
                gameKey={selectedGame}
                selectedZoneId={selectedZoneId}
                lockedZone={selectedZone}
                lockToSelectedZone={isVenueDirectBooking}
                onZoneSelect={(zone) => {
                  setSelectedZoneId(zone.id || null);
                  setSelectedZoneName(zone.venueBrandName || null);
                  setSelectedZone(zone);
                  resetZoneRateSelection();
                }}
                userPreferredAreas={userProfile?.areasPreferred}
              />

              {selectedZoneId && zoneRateOptions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>
                    Category
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
                            selectZoneRateOption(opt.key, opt.price);
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
                  {selectedZoneRateKey ? (
                    <Text style={[styles.helperText, styles.marginTop8]}>
                      {
                        zoneRateOptions.find((opt) => opt.key === selectedZoneRateKey)
                          ?.detailLabel
                      }
                    </Text>
                  ) : null}
                  {!selectedZoneRateKey && (
                    <Text style={[styles.helperText, styles.marginTop8]}>
                      Pick a category to calculate pricing.
                    </Text>
                  )}
                </View>
              )}

              {/* Series Type Selector (CS2 & FC & Tekken) */}
              {(isCsStyleGame(selectedGame) ||
                selectedGame === "fc26" ||
                selectedGame === "tekken8") &&
                selectedZoneId && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                      Series Type<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={[styles.row, styles.gap8]}>
                      {(isCsStyleGame(selectedGame)
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
                      {isCsStyleGame(selectedGame)
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
              availableAreas={availableBroadcastAreas}
              loading={loadingBroadcastAreas}
              preferredAreas={preferredBroadcastAreas}
              selectedAreas={broadcastAreas}
              onToggleArea={toggleBroadcastArea}
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
                    <MotionPressable
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
                    </MotionPressable>
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
            <Text style={styles.sectionLabel}>{effectivePriceLabel}</Text>
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
                  (isCsStyleGame(selectedGame) ||
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
                  effectivePriceValue ? String(effectivePriceValue) : ""
                }
                onChangeText={(text: string) =>
                  handleFieldChange(
                    "pricePerPlayer",
                    text
                      ? Math.ceil(
                          parseInt(text, 10) /
                            (teamMode === "team" &&
                            teamPaymentMode === "captain_pays_all"
                              ? reservedSlots
                              : 1),
                        )
                      : "",
                  )
                }
                keyboardType="number-pad"
                  editable={
                    selectedGame !== "cs2" &&
                    selectedGame !== "cs16" &&
                    selectedGame !== "valorant" &&
                    selectedGame !== "fc26" &&
                  selectedGame !== "tekken8" &&
                  selectedGame !== "futsal" &&
                  selectedGame !== "indoor_cricket" &&
                  selectedGame !== "padel" &&
                  selectedGame !== "pickleball"
                }
              />
              {(isCsStyleGame(selectedGame) ||
                selectedGame === "fc26" ||
                selectedGame === "tekken8" ||
                selectedGame === "futsal" ||
                selectedGame === "indoor_cricket" ||
                selectedGame === "padel" ||
                selectedGame === "pickleball") && (
                  <AppIcon
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
            {teamMode === "team" && (
              <Text
                style={{
                  color: COLORS.muted,
                  fontSize: 11,
                  marginTop: 4,
                  marginLeft: 4,
                }}
              >
                {teamPaymentMode === "captain_pays_all"
                  ? `Captain is paying for ${reservedSlots} slot${reservedSlots === 1 ? "" : "s"} right now.`
                  : "Only the captain's own slot is charged right now."}
              </Text>
            )}
            {(isCsStyleGame(selectedGame) ||
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
                    <AppIcon
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
                    {selectedGame === "cs16"
                      ? "CS 1.6 uses in-app self-assessment and role matching."
                      : selectedGame === "valorant"
                        ? "Valorant uses in-app self-assessment and role matching."
                        : "MatchHai uses your stored skill and any linked accounts to place you in the right bracket."}
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
                      <AppIcon
                        name="verified-user"
                        size={16}
                        color={COLORS.accent}
                      />
                      {selectedGame === "cs16" ? (
                        <>{"\u00A0"}CS 1.6 competitive lobbies use your questionnaire-based skill tier and selected role.</>
                      ) : selectedGame === "valorant" ? (
                        <>{"\u00A0"}Valorant competitive lobbies use your questionnaire-based skill tier and selected role.</>
                      ) : (
                        <>
                          {"\u00A0"}CS2 competitive lobbies use your saved MatchHai skill. Steam or FACEIT can improve calibration, but they are not required to host.
                        </>
                      )}
                    </Text>
                  </View>
                </>
              )}
          </View>

          {/* Submit Summary */}
          <View style={styles.submitSummaryWrapper}>
            {/* CS2 Summary Line */}
            {isCsStyleGame(selectedGame) && formData.format && (
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
                  {`Hosting ${selectedGame === "cs16" ? "CS 1.6" : selectedGame === "valorant" ? "Valorant" : "CS2"} 5v5 in `}
                  <Text style={{ color: COLORS.accent }}>
                    {locationMode === "broadcast"
                      ? `${broadcastAreas.length > 0 ? broadcastAreas.join(", ") : userProfile?.areasPreferred?.join(", ") || "preferred areas"} `
                      : selectedZoneName || "selected zone"}
                  </Text>
                  {" ? "}
                  <Text style={{ color: COLORS.accent }}>
                    {hostSkillTier || formData.skillLevel || "Any skill"}
                  </Text>
                  {formData.selectedMaps &&
                    formData.selectedMaps.length > 0 && (
                      <>
                        {" ? "}
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
                  {" ? "}
                  <Text style={{ color: COLORS.accent }}>
                    {hostSkillTier || formData.skillLevel || "Any bracket"}
                  </Text>
                  {Array.isArray(formData.tekkenCharacters) &&
                    formData.tekkenCharacters.length > 0 && (
                      <>
                        {" ? "}
                        <Text style={{ color: COLORS.accent }}>
                          {formData.tekkenCharacters.join(", ")}
                        </Text>
                      </>
                    )}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}
      {renderEasypaisaRecoveryBanner()}
      </Animated.ScrollView>

      {selectedGame ? (
        <BottomActionBar>
          <Pressable
            onPressIn={onSubmitPressIn}
            onPressOut={onSubmitPressOut}
            style={({ pressed }) => [
              styles.primaryButton,
              (!isEasypaisaPaymentActive && (!canSubmit || submitting || emailVerificationLocked)) &&
                styles.primaryButtonDisabled,
              pressed &&
              (isEasypaisaPaymentActive || canSubmit) &&
              !submitting &&
              !emailVerificationLocked &&
              styles.primaryButtonPressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              if (isEasypaisaPaymentActive) {
                if (isEasypaisaFinalized) {
                  openFinalizedEasypaisaMatchroom();
                  return;
                }
                openEasypaisaPhonePrompt();
                return;
              }
              setSubmitFeedback(null);
              if (emailVerificationLocked) {
                showKycVerificationRequiredAlert();
                return;
              }
              if (!canSubmit) {
                showToast({
                  message: submitBlockers[0] || "Please complete required fields.",
                  title: "Complete required fields",
                  type: "warning",
                });
                return;
              }
              if (!validateForm()) return;
              handleSubmit();
            }}
            disabled={submitting && !isEasypaisaPaymentActive}
          >
            <Animated.View style={submitMotionStyle}>
              {submitting && !isEasypaisaPaymentActive ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isEasypaisaFinalized
                    ? "Open Matchroom"
                    : isEasypaisaPaymentActive
                    ? "Open Payment Status"
                    : locationMode === "broadcast"
                      ? "Send Broadcast"
                      : "Send Booking Request"}
                </Text>
              )}
            </Animated.View>
          </Pressable>
          {!canSubmit && (
            <Text style={[styles.helperTextTiny, styles.submitHintText]}>
              Complete required fields: {submitBlockers[0]}
            </Text>
          )}
          {submitFeedback && !shouldHideSubmitFeedbackForConfirmedPayment ? (
            <Text
              style={[
                styles.helperTextTiny,
                styles.submitFeedbackText,
                { color: submitFeedbackColor },
              ]}
            >
              {submitFeedback.title}: {submitFeedback.message}
            </Text>
          ) : null}
        </BottomActionBar>
      ) : null}

      <GameActivationPromptModal
        visible={showActivationPrompt}
        gameLabel={selectedGame || "Game"}
        loading={activating}
        onClose={closeActivationPrompt}
        onConfirm={confirmActivation}
      />

      <SkillAssessmentModal
        visible={showAssessment}
        onClose={closeAssessment}
        gameKey={(selectedGame || "cs2") as any}
        userId={user?._id || ""}
        onSuccess={completeAssessment}
      />

      <AppDialog
        visible={showEasypaisaPhonePrompt}
        onClose={closeEasypaisaPhonePrompt}
        dismissDisabled={isEasypaisaPaymentLocked}
        cardStyle={styles.phoneDialogCard}
        keyboardAware={true}
      >
        <AppModalHeader
          title={easypaisaDialogTitle}
          subtitle={easypaisaDialogSubtitle}
          onClose={closeEasypaisaPhonePrompt}
          closeDisabled={isEasypaisaPaymentLocked}
        />
        <AppModalBody
          scroll
          style={styles.phoneDialogContent}
          contentContainerStyle={styles.phoneModalContent}
        >
          <Text style={styles.phoneAmountLabel}>
            {isEasypaisaPaymentConfirmed ? "Amount paid" : "Matchroom payment"}: {formatCurrency(Number(easypaisaPaymentAmount || 0))}
          </Text>
          {isEasypaisaPaymentActive ? (
            <View style={styles.paymentStatusPanel}>
              <View style={[styles.paymentStatusIcon, { borderColor: easypaisaStatusColor }]}>
                {easypaisaPaymentPhase === "payment_sent" ||
                easypaisaPaymentPhase === "confirmed" ||
                easypaisaPaymentPhase === "completing" ? (
                  <ActivityIndicator color={easypaisaStatusColor} />
                ) : (
                  <AppIcon name={easypaisaStatusIcon as any} size={34} color={easypaisaStatusColor} />
                )}
              </View>
              <Text style={styles.paymentStatusTitle}>
                {isEasypaisaFinalized
                  ? "Matchroom created"
                  : easypaisaPaymentPhase === "payment_sent"
                  ? "Payment pending"
                  : easypaisaPaymentPhase === "completion_failed"
                    ? "Payment received"
                  : easypaisaPaymentPhase === "failed"
                    ? "Payment not completed"
                    : easypaisaPaymentPhase === "expired"
                      ? "Payment not completed"
                      : "Payment confirmed"}
              </Text>
              <Text style={styles.paymentStatusText}>{easypaisaStatusMessage}</Text>
              {activeEasypaisaOrderRef ? (
                <Text style={styles.paymentStatusMeta}>
                  Order: {activeEasypaisaOrderRef}
                </Text>
              ) : null}
              {showEasypaisaUnverifiedStatus ? (
                <Text style={styles.paymentStatusMeta}>
                  Status: {PAYMENT_VERIFICATION_SAFE_MESSAGE}
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.phoneSectionLabel}>Mobile Account Number</Text>
              <TextInput
                style={styles.phoneInput}
                keyboardType="phone-pad"
                value={easypaisaCheckoutPhone}
                onChangeText={handleEasypaisaPhoneChange}
                placeholder="03XX XXX XXXX"
                placeholderTextColor={COLORS.textSecondary}
                editable={!startingEasypaisaPayment}
              />
            </>
          )}
        </AppModalBody>
        <AppModalFooter style={styles.phoneFooter}>
          {isEasypaisaPaymentActive ? (
            <View style={styles.phoneActionsRow}>
              {isEasypaisaFinalized ? (
                <AppButton
                  style={styles.phoneActionBtn}
                  onPress={openFinalizedEasypaisaMatchroom}
                >
                  Open matchroom
                </AppButton>
              ) : easypaisaPaymentPhase === "completion_failed" ? (
                <>
                  <AppButton
                    style={styles.phoneActionBtn}
                    onPress={() => void continueEasypaisaPayment()}
                    loading={refreshingEasypaisaStatus}
                    disabled={refreshingEasypaisaStatus}
                  >
                    Retry finishing
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    style={styles.phoneActionBtn}
                    onPress={hideEasypaisaPhonePrompt}
                  >
                    Close
                  </AppButton>
                </>
              ) : easypaisaPaymentPhase === "failed" || easypaisaPaymentPhase === "expired" ? (
                <>
                  <AppButton
                    variant="secondary"
                    style={styles.phoneActionBtn}
                    onPress={hideEasypaisaPhonePrompt}
                  >
                    Do this later
                  </AppButton>
                  <AppButton
                    style={styles.phoneActionBtn}
                    onPress={resetEasypaisaPaymentPrompt}
                  >
                    Try again
                  </AppButton>
                </>
              ) : easypaisaPaymentPhase === "confirmed" || easypaisaPaymentPhase === "completing" ? (
                <Text style={[styles.paymentStatusMeta, styles.paymentStatusFooterNote]}>
                  This may take a few seconds.
                </Text>
              ) : (
                <>
                  <AppButton
                    variant="secondary"
                    style={styles.phoneActionBtn}
                    onPress={hideEasypaisaPhonePrompt}
                  >
                    Do this later
                  </AppButton>
                  <AppButton
                    style={styles.phoneActionBtn}
                    onPress={() => void continueEasypaisaPayment()}
                    loading={refreshingEasypaisaStatus}
                    disabled={refreshingEasypaisaStatus}
                  >
                    I've paid / Refresh
                  </AppButton>
                </>
              )}
            </View>
          ) : (
            <View style={styles.phoneActionsRow}>
              <AppButton
                variant="secondary"
                style={styles.phoneActionBtn}
                onPress={closeEasypaisaPhonePrompt}
                disabled={startingEasypaisaPayment}
              >
                Cancel
              </AppButton>
              <AppButton
                style={styles.phoneActionBtn}
                onPress={() => void confirmEasypaisaPayment()}
                loading={startingEasypaisaPayment}
                disabled={startingEasypaisaPayment}
                perf={{
                  actionKey: "matchroom_create_easypaisa_phone_confirm",
                  meta: {
                    source: "matchroom_create",
                  },
                }}
              >
                Continue to Pay
              </AppButton>
            </View>
          )}
        </AppModalFooter>
      </AppDialog>
    </Screen>
  );
}
