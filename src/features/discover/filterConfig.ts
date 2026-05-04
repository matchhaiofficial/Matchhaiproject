import { GAME_FIELDS } from "../../../constants/matchConfig";
import {
  CONSOLE_PLATFORMS,
  CS2_ROLES,
  FUTSAL_POSITIONS,
  INDOOR_CRICKET_ROLES,
  KARACHI_AREAS,
  PADEL_ROLES,
  PICKLEBALL_ROLES,
  VALORANT_ROLES,
} from "../../../constants/profileOptions";
import {
  TIMELINE_FILTERS,
  type TimelineFilterKey,
} from "../../constants/timelineFilters";
import type { DiscoverSegment, GameKey } from "./types";

export type VenueType = "all" | "zones" | "courts";
export type TeamMode = "discover" | "my";

export type MatchroomFilters = {
  game: GameKey;
  skill: string;
  format: string;
  role: string;
  series: string;
  overs: string;
  area: string;
  skillLevel: string;
  timeline: TimelineFilterKey;
  openSlots: string;
  priceRange: string;
};

export type PlayerFilters = {
  game: GameKey;
  role: string;
  skill: string;
  availability: string;
  area: string;
  platform: string;
  competitiveIntent: string;
};

export type TeamFilters = {
  game: GameKey;
  mode: TeamMode;
  availability: string;
  teamSize: string;
  area: string;
  competitiveIntent: string;
};

export type ZoneFilters = {
  venueType: VenueType;
  gameOrSport: string;
  proximity: string;
  area: string;
  priceRange: string;
  platform: string;
};

export type DiscoverFiltersState = {
  matchrooms: MatchroomFilters;
  players: PlayerFilters;
  teams: TeamFilters;
  zones: ZoneFilters;
};

export const DISCOVER_GAMES: Array<{ key: GameKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "cs2", label: "CS2" },
  { key: "cs16", label: "CS 1.6" },
  { key: "valorant", label: "Valorant" },
  { key: "fc26", label: "FC26" },
  { key: "tekken8", label: "Tekken 8" },
  // Physical sports are temporarily disabled.
  // { key: "futsal", label: "Futsal" },
  // { key: "indoor_cricket", label: "Cricket" },
  // { key: "padel", label: "Padel" },
  // { key: "pickleball", label: "Pickleball" },
];

export const DISCOVER_VENUE_TYPES: Array<{ key: VenueType; label: string }> = [
  { key: "all", label: "All Venues" },
  { key: "zones", label: "Gaming Zones" },
  // Physical sports are temporarily disabled.
  // { key: "courts", label: "Sports Courts" },
];

export const SEGMENT_LABELS: Record<DiscoverSegment, string> = {
  matchrooms: "Rooms",
  players: "Players",
  teams: "Teams",
  zones: "Venues",
};

export const SKILL_LEVEL_OPTIONS = [
  "Any",
  "Casual",
  "Competitive",
  "Pro / Tournament",
];

export const CS2_SKILL_LEVELS = [
  "Any",
  "FACEIT 1-3",
  "FACEIT 4-6",
  "FACEIT 7-10",
];

export const QUESTIONNAIRE_SKILL_LEVELS = [
  "Any",
  "Beginner",
  "Casual",
  "Intermediate",
  "Advanced",
  "Pro",
  "Elite",
];

export const OVERS_OPTIONS = ["Any", "5", "6"];

export const LOCATION_OPTIONS = [
  "Any",
  ...KARACHI_AREAS,
];

export const PLAYER_AVAILABILITY_OPTIONS = ["Any", "Online Now"];
export const ROOM_SLOT_OPTIONS = ["Any", "Open Slots"];
export const TEAM_AVAILABILITY_OPTIONS = ["All", "Recruiting Now"];
export const TEAM_SIZE_OPTIONS = ["Any", "1-2 players", "3-5 players", "Full Team"];
export const COMPETITIVE_LEVEL_OPTIONS = [
  "Any",
  "Casual",
  "Competitive",
  "Tournament-focused",
];
export const PLAYER_COMPETITIVE_INTENT_OPTIONS = ["Any", "Casual", "Competitive"];
export const PLATFORM_OPTIONS = [
  { key: "Any", label: "Any" },
  ...CONSOLE_PLATFORMS.filter((platform) =>
    ["ps5", "xbox-series", "xbox-one", "mixed"].includes(platform.value),
  ).map((platform) => ({
    key:
      platform.value === "ps5"
        ? "PS5"
        : platform.value === "mixed"
          ? "PS5 + Xbox"
          : "Xbox",
    label:
      platform.value === "ps5"
        ? "PS5"
        : platform.value === "mixed"
          ? "PS5 + Xbox"
          : "Xbox",
  })),
].filter(
  (option, index, list) => list.findIndex((item) => item.key === option.key) === index,
);
export const ROOM_PRICE_RANGE_OPTIONS = [
  "Any",
  "Under PKR 500",
  "PKR 500-1000",
  "PKR 1000+",
];
export const VENUE_PRICE_RANGE_OPTIONS = [
  "Any",
  "Under PKR 1000",
  "PKR 1000-2000",
  "PKR 2000+",
];
export const PROXIMITY_OPTIONS = ["Any", "Same Area", "Same City"];

const ESPORTS_GAMES = [
  { key: "all", label: "All" },
  { key: "cs2", label: "CS2" },
  { key: "cs16", label: "CS 1.6" },
  { key: "valorant", label: "Valorant" },
  { key: "fc26", label: "FC26" },
  { key: "tekken8", label: "Tekken 8" },
];

const SPORTS_GAMES = [
  { key: "all", label: "All" },
  // Physical sports are temporarily disabled.
  // { key: "futsal", label: "Futsal" },
  // { key: "indoor_cricket", label: "Cricket" },
  // { key: "padel", label: "Padel" },
  // { key: "pickleball", label: "Pickleball" },
];

export const DEFAULT_MATCHROOM_FILTERS: MatchroomFilters = {
  game: "all",
  skill: "Any",
  format: "Any",
  role: "Any",
  series: "Any",
  overs: "Any",
  area: "Any",
  skillLevel: "Any",
  timeline: "any",
  openSlots: "Any",
  priceRange: "Any",
};

export const DEFAULT_PLAYER_FILTERS: PlayerFilters = {
  game: "all",
  role: "Any",
  skill: "Any",
  availability: "Any",
  area: "Any",
  platform: "Any",
  competitiveIntent: "Any",
};

export const DEFAULT_TEAM_FILTERS: TeamFilters = {
  game: "all",
  mode: "discover",
  availability: "All",
  teamSize: "Any",
  area: "Any",
  competitiveIntent: "Any",
};

export const DEFAULT_ZONE_FILTERS: ZoneFilters = {
  venueType: "all",
  gameOrSport: "all",
  proximity: "Any",
  area: "Any",
  priceRange: "Any",
  platform: "Any",
};

export const DEFAULT_DISCOVER_FILTERS: DiscoverFiltersState = {
  matchrooms: DEFAULT_MATCHROOM_FILTERS,
  players: DEFAULT_PLAYER_FILTERS,
  teams: DEFAULT_TEAM_FILTERS,
  zones: DEFAULT_ZONE_FILTERS,
};

export function getMatchroomFormatOptions(game: GameKey) {
  if (game === "all") return [];
  const fields = GAME_FIELDS[game as keyof typeof GAME_FIELDS];
  if (!fields) return [];
  return ["Any", ...(fields.formats || [])];
}

export function getRoleOptions(game: GameKey) {
  switch (game) {
    case "cs2":
    case "cs16":
      return ["Any", ...CS2_ROLES];
    case "valorant":
      return ["Any", ...VALORANT_ROLES];
    case "futsal":
      return ["Any", ...FUTSAL_POSITIONS];
    case "indoor_cricket":
      return ["Any", ...INDOOR_CRICKET_ROLES];
    case "padel":
      return ["Any", ...PADEL_ROLES];
    case "pickleball":
      return ["Any", ...PICKLEBALL_ROLES];
    default:
      return [];
  }
}

export function getMatchroomSeriesOptions(game: GameKey) {
  switch (game) {
    case "cs2":
    case "cs16":
    case "valorant":
      return ["Any", "BO1", "BO3", "BO5"];
    case "fc26":
    case "tekken8":
      return ["Any", "BO3", "BO5", "BO7", "BO10"];
    case "padel":
    case "pickleball":
      return ["Any", "BO3", "BO5", "BO10"];
    case "indoor_cricket":
      return ["Any", "BO3"];
    default:
      return [];
  }
}

export function hasMatchroomFormatFilter(game: GameKey) {
  return ["fc26", "tekken8", "futsal", "pickleball"].includes(game);
}

export function hasMatchroomRoleFilter(game: GameKey) {
  return [
    "cs2",
    "cs16",
    "valorant",
    "futsal",
    "indoor_cricket",
    "padel",
    "pickleball",
  ].includes(game);
}

export function hasMatchroomSeriesFilter(game: GameKey) {
  return getMatchroomSeriesOptions(game).length > 0;
}

export function hasMatchroomOversFilter(game: GameKey) {
  return game === "indoor_cricket";
}

export function hasCs2SkillFilter(game: GameKey) {
  return game === "cs2";
}

export function hasQuestionnaireSkillFilter(game: GameKey) {
  return game === "cs16" || game === "valorant";
}

export function hasPlayerRoleFilter(game: GameKey) {
  return [
    "cs2",
    "cs16",
    "valorant",
    "futsal",
    "indoor_cricket",
    "padel",
    "pickleball",
  ].includes(game);
}

export function getPlayerSkillOptions(game: GameKey) {
  if (game === "cs2") return CS2_SKILL_LEVELS;
  if (game === "cs16" || game === "valorant") return QUESTIONNAIRE_SKILL_LEVELS;
  return [];
}

export function hasPlatformFilter(game: GameKey | string) {
  return game === "fc26" || game === "tekken8";
}

export function getZoneGameOptions(venueType: VenueType) {
  if (venueType === "zones") return ESPORTS_GAMES;
  if (venueType === "courts") return SPORTS_GAMES;
  return [];
}

export function getPrimaryContextLabel(
  segment: DiscoverSegment,
  filters: DiscoverFiltersState,
) {
  if (segment === "zones") {
    const selectedVenueType = filters.zones.venueType;
    return (
      DISCOVER_VENUE_TYPES.find((item) => item.key === selectedVenueType)?.label ||
      "All Venues"
    );
  }

  const game = filters[segment].game;
  return DISCOVER_GAMES.find((item) => item.key === game)?.label || "All";
}

export function getDrawerSubtitle(
  segment: DiscoverSegment,
  filters: DiscoverFiltersState,
) {
  return `${SEGMENT_LABELS[segment]} - ${getPrimaryContextLabel(segment, filters)}`;
}

export function countActiveMatchroomFilters(filters: MatchroomFilters) {
  let count = 0;
  if (filters.game !== DEFAULT_MATCHROOM_FILTERS.game) count += 1;
  if (filters.skill !== DEFAULT_MATCHROOM_FILTERS.skill) count += 1;
  if (filters.format !== DEFAULT_MATCHROOM_FILTERS.format) count += 1;
  if (filters.role !== DEFAULT_MATCHROOM_FILTERS.role) count += 1;
  if (filters.series !== DEFAULT_MATCHROOM_FILTERS.series) count += 1;
  if (filters.overs !== DEFAULT_MATCHROOM_FILTERS.overs) count += 1;
  if (filters.area !== DEFAULT_MATCHROOM_FILTERS.area) count += 1;
  if (filters.skillLevel !== DEFAULT_MATCHROOM_FILTERS.skillLevel) count += 1;
  if (filters.timeline !== DEFAULT_MATCHROOM_FILTERS.timeline) count += 1;
  if (filters.openSlots !== DEFAULT_MATCHROOM_FILTERS.openSlots) count += 1;
  if (filters.priceRange !== DEFAULT_MATCHROOM_FILTERS.priceRange) count += 1;
  return count;
}

export function countActivePlayerFilters(filters: PlayerFilters) {
  let count = 0;
  if (filters.game !== DEFAULT_PLAYER_FILTERS.game) count += 1;
  if (filters.role !== DEFAULT_PLAYER_FILTERS.role) count += 1;
  if (filters.skill !== DEFAULT_PLAYER_FILTERS.skill) count += 1;
  if (filters.availability !== DEFAULT_PLAYER_FILTERS.availability) count += 1;
  if (filters.area !== DEFAULT_PLAYER_FILTERS.area) count += 1;
  if (filters.platform !== DEFAULT_PLAYER_FILTERS.platform) count += 1;
  if (filters.competitiveIntent !== DEFAULT_PLAYER_FILTERS.competitiveIntent) count += 1;
  return count;
}

export function countActiveTeamFilters(filters: TeamFilters) {
  let count = 0;
  if (filters.game !== DEFAULT_TEAM_FILTERS.game) count += 1;
  if (filters.mode === "my") return count;
  if (filters.availability !== DEFAULT_TEAM_FILTERS.availability) count += 1;
  if (filters.teamSize !== DEFAULT_TEAM_FILTERS.teamSize) count += 1;
  if (filters.area !== DEFAULT_TEAM_FILTERS.area) count += 1;
  if (filters.competitiveIntent !== DEFAULT_TEAM_FILTERS.competitiveIntent) count += 1;
  return count;
}

export function countActiveZoneFilters(filters: ZoneFilters) {
  let count = 0;
  if (filters.venueType !== DEFAULT_ZONE_FILTERS.venueType) count += 1;
  if (filters.gameOrSport !== DEFAULT_ZONE_FILTERS.gameOrSport) count += 1;
  if (filters.proximity !== DEFAULT_ZONE_FILTERS.proximity) count += 1;
  if (filters.area !== DEFAULT_ZONE_FILTERS.area) count += 1;
  if (filters.priceRange !== DEFAULT_ZONE_FILTERS.priceRange) count += 1;
  if (filters.platform !== DEFAULT_ZONE_FILTERS.platform) count += 1;
  return count;
}

export function getActiveFilterCount(
  segment: DiscoverSegment,
  filters: DiscoverFiltersState,
) {
  if (segment === "matchrooms") return countActiveMatchroomFilters(filters.matchrooms);
  if (segment === "players") return countActivePlayerFilters(filters.players);
  if (segment === "teams") return countActiveTeamFilters(filters.teams);
  return countActiveZoneFilters(filters.zones);
}

export function getTimelineOptions() {
  return TIMELINE_FILTERS.map((filter) => ({
    key: filter.key,
    label: filter.label,
  }));
}
