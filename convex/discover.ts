import { query } from "./_generated/server";
import { v } from "convex/values";
import { isUserHiddenFromPublic } from "./userVisibility";
import { requireCurrentUser } from "./authz";

const ACTIVE_FRIEND_REQUEST_TYPES = new Set(["friend_request", "social.friend_request"]);
const ACTIVE_TEAM_JOIN_REQUEST_TYPES = new Set(["team_join_request", "team.join_request"]);
const DISABLED_PHYSICAL_GAME_KEYS = new Set(["futsal", "indoor_cricket", "padel", "pickleball"]);
const PC_SETUP_GAME_KEYS = ["cs2", "cs16", "valorant"] as const;

function normalizeGameKey(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  const compact = normalized.replace(/[\s._-]+/g, "");
  if (compact === "fc25" || compact === "fc26") return "fc26";
  if (compact === "cs2" || compact === "cs16" || compact === "counterstrike16") return compact === "cs2" ? "cs2" : "cs16";
  if (compact === "valorant" || compact === "tekken8") return compact;
  return normalized;
}

function isDisabledPhysicalGame(value?: string | null) {
  return DISABLED_PHYSICAL_GAME_KEYS.has(normalizeGameKey(value));
}

function isPcSetupGame(value?: string | null) {
  const gameKey = normalizeGameKey(value);
  return PC_SETUP_GAME_KEYS.some((key) => key === gameKey);
}

function getGameSet(games: unknown[]) {
  return new Set(games.map((value) => normalizeGameKey(String(value || ""))).filter(Boolean));
}

function isActiveTeam(row: any) {
  return Boolean(row) && row.status !== "deleted" && !row.deletedAt;
}

function playerHasEnabledGame(player: any) {
  return !!(
    player?.playsCs2 ||
    player?.playsCs16 ||
    player?.playsValorant ||
    player?.playsFc ||
    player?.playsTekken
  );
}

function zoneHasEnabledGame(zone: any) {
  const games = zone?.games;
  if (Array.isArray(games)) {
    return games.some((gameKey) => !isDisabledPhysicalGame(String(gameKey || "")));
  }
  return !!(
    games?.supportsCs2 ||
    games?.supportsCs16 ||
    games?.supportsValorant ||
    games?.supportsFc25 ||
    games?.supportsFc26 ||
    games?.supportsTekken8
  );
}

function getZonePreferredBranch(zone: any) {
  const branches = Array.isArray(zone?.branches) ? zone.branches : [];
  return branches[0] || zone?.primaryBranch || {};
}

function getCandidateFetchLimit(limit: number, options: { min: number; max: number; multiplier?: number }) {
  const multiplier = options.multiplier || 3;
  return Math.min(options.max, Math.max(options.min, limit * multiplier));
}

function uniqueRowsById(rows: any[]) {
  const byId = new Map<string, any>();
  rows.forEach((row) => {
    if (row?._id) byId.set(String(row._id), row);
  });
  return Array.from(byId.values());
}

function getSafeDiscoverLimit(value: number | undefined, fallback: number, max: number) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function parseRoomStartAt(room: any) {
  if (typeof room?.scheduledStartAt === "number") return room.scheduledStartAt;
  const date = String(room?.scheduledDate || "").trim();
  const time = String(room?.scheduledTime || "").trim();
  if (!date) return null;
  const parsed = new Date(`${date}T${time || "00:00"}`);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function matchesTimeline(room: any, timeline: string) {
  if (timeline === "any") return true;
  const startAt = parseRoomStartAt(room);
  if (startAt == null) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  if (timeline === "today") {
    return startAt >= todayStart && startAt < todayEnd;
  }
  if (timeline === "next_3_days") {
    return startAt >= todayEnd && startAt < todayStart + 3 * 24 * 60 * 60 * 1000;
  }
  if (timeline === "next_1_week") {
    return startAt >= todayStart + 3 * 24 * 60 * 60 * 1000 && startAt < todayStart + 7 * 24 * 60 * 60 * 1000;
  }
  return true;
}

const NON_DISCOVERABLE_ROOM_STATUSES = new Set([
  "completed",
  "cancelled",
  "expired",
  "closed",
  "in-progress",
  "admin_review",
  "payment_failed",
]);

function isRosterFullForDiscover(room: any) {
  const slotsA = Array.isArray(room?.slotsA) ? room.slotsA : [];
  const slotsB = Array.isArray(room?.slotsB) ? room.slotsB : [];
  if (slotsA.length === 0 && slotsB.length === 0) return false;
  const teamAFilled =
    slotsA.length === 0 ||
    slotsA.every((slot: any) => slot?.status === "confirmed");
  const teamBFilled =
    slotsB.length === 0 ||
    slotsB.every((slot: any) => slot?.status === "confirmed");
  return teamAFilled && teamBFilled;
}

function isRoomExpired(room: any) {
  const status = String(room?.status || "").toLowerCase();
  if (NON_DISCOVERABLE_ROOM_STATUSES.has(status)) return true;

  const now = Date.now();

  // Time-based expiry: if the scheduled start has passed and the roster is not
  // full, the room is no longer joinable even if the lifecycle sweep has not
  // yet stamped `status = "expired"`.
  const scheduledStartAt = parseRoomStartAt(room);
  if (
    scheduledStartAt != null &&
    scheduledStartAt <= now &&
    !isRosterFullForDiscover(room)
  ) {
    return true;
  }

  // Explicit expiry field
  const expiresAt = Number(room?.expiresAt || 0);
  if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now) {
    return true;
  }

  // Broadcast rooms whose zone-response window has elapsed without a zone
  if (
    room?.locationMode === "broadcast" &&
    room?.broadcastRequestStatus === "waiting_for_zones" &&
    Number(room?.broadcastRequestExpiresAt || 0) > 0 &&
    Number(room.broadcastRequestExpiresAt) <= now
  ) {
    return true;
  }

  return false;
}

function isActivePendingNotification(row: any) {
  if (!row || row.isArchived === true) return false;
  if (String(row.status || "") !== "pending") return false;
  return typeof row.expiresAt !== "number" || row.expiresAt > Date.now();
}

function getPlayerRole(player: any, selectedGame: string) {
  if (selectedGame === "futsal") {
    const positions = Array.isArray(player?.futsalPositions) ? player.futsalPositions.filter(Boolean) : [];
    return positions[0] || player?.futsalPosition || null;
  }
  const key = `${selectedGame}Role`;
  return player?.[key] || null;
}

function getPlayerSkillTier(player: any, selectedGame: string) {
  const scores = player?.skillScores || {};
  if (selectedGame === "tekken8") return scores?.tekken8?.tier || scores?.tekken?.tier || null;
  if (selectedGame === "indoor_cricket") return scores?.indoor_cricket?.tier || scores?.cricket?.tier || null;
  return scores?.[selectedGame]?.tier || null;
}

function playerHasGameEnabled(player: any, selectedGame: string) {
  switch (selectedGame) {
    case "cs2":
      return !!player?.playsCs2;
    case "cs16":
      return !!player?.playsCs16;
    case "valorant":
      return !!player?.playsValorant;
    case "fc26":
      return !!player?.playsFc;
    case "tekken8":
      return !!player?.playsTekken;
    case "futsal":
      return !!player?.playsFutsal;
    case "indoor_cricket":
      return !!player?.playsIndoorCricket;
    case "padel":
      return !!player?.playsPadel;
    case "pickleball":
      return !!player?.playsPickleball;
    default:
      return true;
  }
}

function matchesPlayerSkill(player: any, selectedGame: string, selectedSkill: string) {
  if (selectedSkill === "Any" || selectedGame === "all") return true;
  if (selectedGame === "cs2") {
    const elo = Number(player?.faceitElo || 0);
    if (selectedSkill === "FACEIT 1-3") return elo >= 1 && elo < 1101;
    if (selectedSkill === "FACEIT 4-6") return elo >= 1101 && elo < 1551;
    if (selectedSkill === "FACEIT 7-10") return elo >= 1551;
    return true;
  }
  const tier = getPlayerSkillTier(player, selectedGame);
  return String(tier || "").trim() === selectedSkill;
}

function matchesAreaSelection(values: unknown, selectedArea: string) {
  if (selectedArea === "Any") return true;

  if (Array.isArray(values)) {
    return values.some(
      (value) =>
        String(value || "").trim().toLowerCase() === selectedArea.trim().toLowerCase(),
    );
  }

  return String(values || "").toLowerCase().includes(selectedArea.trim().toLowerCase());
}

function classifyPlayerCompetitiveIntent(player: any, selectedGame: string) {
  if (selectedGame === "all") {
    const hasCompetitiveSignal =
      Number(player?.faceitElo || 0) > 0 ||
      !!player?.psnOnlineId ||
      !!player?.xboxGamertag ||
      Object.values(player?.skillScores || {}).some((score: any) =>
        ["intermediate", "advanced", "competitive", "pro", "elite"].some((token) =>
          String(score?.tier || "").toLowerCase().includes(token),
        ),
      );
    return hasCompetitiveSignal ? "Competitive" : "Casual";
  }

  if (selectedGame === "cs2") {
    return Number(player?.faceitElo || 0) > 0 ? "Competitive" : "Casual";
  }

  if (selectedGame === "fc26" || selectedGame === "tekken8") {
    return player?.psnOnlineId || player?.xboxGamertag ? "Competitive" : "Casual";
  }

  const tier = String(getPlayerSkillTier(player, selectedGame) || "").toLowerCase();
  return ["intermediate", "advanced", "competitive", "pro", "elite"].some((token) =>
    tier.includes(token),
  )
    ? "Competitive"
    : "Casual";
}

function matchesConsolePlatform(player: any, platform: string) {
  if (platform === "Any") return true;
  if (platform === "PS5") return !!player?.psnOnlineId;
  if (platform === "Xbox") return !!player?.xboxGamertag;
  if (platform === "PS5 + Xbox") return !!player?.psnOnlineId && !!player?.xboxGamertag;
  return true;
}

function roomHasOpenSlots(room: any) {
  const slotsA = Array.isArray(room?.slotsA) ? room.slotsA : [];
  const slotsB = Array.isArray(room?.slotsB) ? room.slotsB : [];
  return [...slotsA, ...slotsB].some((slot: any) => slot?.status === "open");
}

function matchesRoomPriceRange(room: any, selectedPriceRange: string) {
  if (selectedPriceRange === "Any") return true;
  const price = Number(room?.pricing?.perPlayer || 0);
  if (!Number.isFinite(price) || price <= 0) return false;
  if (selectedPriceRange === "Under PKR 500") return price < 500;
  if (selectedPriceRange === "PKR 500-1000") return price >= 500 && price <= 1000;
  if (selectedPriceRange === "PKR 1000+") return price > 1000;
  return true;
}

function getZoneStartingRate(zone: any, gameKey: string) {
  const canonicalGameKey = gameKey === "fc25" ? "fc26" : gameKey;
  const pricing = zone?.branches?.[0]?.pricing || zone?.pricing;

  if (!pricing) return null;

  const toPositiveNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  if (canonicalGameKey === "all") {
    const candidates = [
      pricing?.pc?.regular?.price,
      pricing?.pc?.premium?.price,
      pricing?.pc?.elite?.price,
      pricing?.console?.regular?.price1v1,
      pricing?.console?.regular?.price2v2,
      pricing?.console?.premium?.price1v1,
      pricing?.console?.premium?.price2v2,
      pricing?.console?.elite?.price1v1,
      pricing?.console?.elite?.price2v2,
      pricing?.console?.ps5?.price1v1,
      pricing?.console?.ps5?.price2v2,
      pricing?.console?.xbox?.price1v1,
      pricing?.console?.xbox?.price2v2,
    ]
      .map(toPositiveNumber)
      .filter(Boolean) as number[];
    return candidates.length > 0 ? Math.min(...candidates) : null;
  }

  if (canonicalGameKey === "cs2" || canonicalGameKey === "cs16" || canonicalGameKey === "valorant") {
    return (
      toPositiveNumber(pricing?.pc?.regular?.price) ||
      toPositiveNumber(pricing?.pc?.premium?.price) ||
      toPositiveNumber(pricing?.pc?.elite?.price)
    );
  }

  if (canonicalGameKey === "fc26" || canonicalGameKey === "tekken8") {
    return (
      toPositiveNumber(pricing?.console?.regular?.price1v1) ||
      toPositiveNumber(pricing?.console?.regular?.price2v2) ||
      toPositiveNumber(pricing?.console?.premium?.price1v1) ||
      toPositiveNumber(pricing?.console?.premium?.price2v2) ||
      toPositiveNumber(pricing?.console?.elite?.price1v1) ||
      toPositiveNumber(pricing?.console?.elite?.price2v2) ||
      toPositiveNumber(pricing?.console?.ps5?.price1v1) ||
      toPositiveNumber(pricing?.console?.ps5?.price2v2) ||
      toPositiveNumber(pricing?.console?.xbox?.price1v1) ||
      toPositiveNumber(pricing?.console?.xbox?.price2v2)
    );
  }

  const sportBuckets: Record<string, any> = {
    futsal: pricing?.futsal,
    indoor_cricket: pricing?.indoorCricket || pricing?.indoor_cricket,
    padel: pricing?.padel,
    pickleball: pricing?.pickleball,
  };
  const bucket = sportBuckets[canonicalGameKey];
  if (!bucket) return null;

  const values = Object.values(bucket)
    .map((entry: any) => toPositiveNumber(entry?.price))
    .filter(Boolean) as number[];
  return values.length > 0 ? Math.min(...values) : null;
}

function matchesVenuePriceRange(zone: any, selectedPriceRange: string, selectedGame: string) {
  if (selectedPriceRange === "Any") return true;
  const rate = getZoneStartingRate(zone, selectedGame);
  if (!Number.isFinite(rate) || (rate as number) <= 0) return false;
  if (selectedPriceRange === "Under PKR 1000") return (rate as number) < 1000;
  if (selectedPriceRange === "PKR 1000-2000") {
    return (rate as number) >= 1000 && (rate as number) <= 2000;
  }
  if (selectedPriceRange === "PKR 2000+") return (rate as number) > 2000;
  return true;
}

function matchesVenuePlatform(zone: any, platform: string) {
  if (platform === "Any") return true;
  const pricing = zone?.branches?.[0]?.pricing || zone?.pricing || {};
  const consolePlatform = String(zone?.capacity?.consolePlatform || "").toLowerCase();
  const hasTieredConsole =
    Number(pricing?.console?.regular?.count || 0) > 0 ||
    Number(pricing?.console?.premium?.count || 0) > 0 ||
    Number(pricing?.console?.elite?.count || 0) > 0;
  const hasPs5 = Number(pricing?.console?.ps5?.count || 0) > 0 || hasTieredConsole || consolePlatform.includes("ps5");
  const hasXbox = Number(pricing?.console?.xbox?.count || 0) > 0 || consolePlatform.includes("xbox");

  if (platform === "PS5") return hasPs5;
  if (platform === "Xbox") return hasXbox;
  if (platform === "PS5 + Xbox") return hasPs5 && hasXbox;
  return true;
}

export const listDiscoverPlayers = query({
  args: {
    viewerUserId: v.id("users"),
    selectedGame: v.string(),
    searchQuery: v.string(),
    selectedRole: v.string(),
    selectedSkill: v.string(),
    selectedAvailability: v.string(),
    selectedArea: v.string(),
    selectedPlatform: v.string(),
    selectedCompetitiveIntent: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const viewerUserId = actor.user._id;
    const limit = getSafeDiscoverLimit(args.limit, 150, 1000);
    if (isDisabledPhysicalGame(args.selectedGame)) {
      return [];
    }

    const search = args.searchQuery.trim().toLowerCase();
    const playerFetchLimit = getCandidateFetchLimit(limit, { min: 120, max: 1200 });
    const playersQuery = search
      ? ctx.db
        .query("users")
        .withIndex("by_usernameLower", (q) =>
          q.gte("usernameLower", search).lt("usernameLower", `${search}\uffff`)
        )
      : ctx.db
        .query("users")
        .withIndex("by_accountType", (q) => q.eq("accountType", "player"));
    const [players, friendships, pendingRequests] = await Promise.all([
      playersQuery.take(playerFetchLimit),
      ctx.db.query("friendships").withIndex("by_userId", (q) => q.eq("userId", viewerUserId)).collect(),
      ctx.db
        .query("notifications")
        .withIndex("by_fromUid", (q) => q.eq("fromUid", viewerUserId))
        .order("desc")
        .collect(),
    ]);

    const friendIds = new Set(friendships.map((row) => String(row.friendId)));
    const pendingIds = new Set(
      pendingRequests
        .filter((row: any) => ACTIVE_FRIEND_REQUEST_TYPES.has(String(row.type || "")))
        .filter(isActivePendingNotification)
        .map((row: any) => String(row.toUid))
    );
    const presenceNow = Date.now();
    const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000;
    const isPlayerOnline = (player: any) =>
      !!(player?.isOnline && player.lastActiveAt && (presenceNow - player.lastActiveAt) < PRESENCE_TIMEOUT_MS);

    return players
      .filter((player: any) => String(player._id) !== String(viewerUserId))
      .filter((player: any) => player.accountType === "player")
      .filter((player: any) => !isUserHiddenFromPublic(player))
      .filter(playerHasEnabledGame)
      .filter((player: any) => !search || String(player.username || "").toLowerCase().includes(search))
      .filter((player: any) => args.selectedGame === "all" || playerHasGameEnabled(player, args.selectedGame))
      .filter((player: any) => {
        if (args.selectedRole === "Any" || args.selectedGame === "all") return true;
        return String(getPlayerRole(player, args.selectedGame) || "") === args.selectedRole;
      })
      .filter((player: any) => matchesPlayerSkill(player, args.selectedGame, args.selectedSkill))
      .filter((player: any) => {
        if (args.selectedAvailability === "Any") return true;
        if (args.selectedAvailability === "Online Now") return isPlayerOnline(player);
        if (args.selectedAvailability === "Offline") return !isPlayerOnline(player);
        return true;
      })
      .filter((player: any) => matchesAreaSelection(player?.areasPreferred, args.selectedArea))
      .filter((player: any) => matchesConsolePlatform(player, args.selectedPlatform))
      .filter((player: any) => {
        if (args.selectedCompetitiveIntent === "Any") return true;
        return classifyPlayerCompetitiveIntent(player, args.selectedGame) === args.selectedCompetitiveIntent;
      })
      .slice(0, limit)
      .map((player: any) => ({
        _id: player._id,
        uid: String(player._id),
        username: player.username || "Unknown",
        isOnline: isPlayerOnline(player),
        primaryGames: player.primaryGames || [],
        faceitElo: player.faceitElo,
        faceitSkillLevel: player.faceitSkillLevel,
        skillScores: player.skillScores || {},
        fcTeam: player.fcTeam,
        tekkenFavorites: player.tekkenFavorites || [],
        playsCs2: !!player.playsCs2,
        playsCs16: !!player.playsCs16,
        playsValorant: !!player.playsValorant,
        playsFc: !!player.playsFc,
        playsTekken: !!player.playsTekken,
        playsFutsal: !!player.playsFutsal,
        playsIndoorCricket: !!player.playsIndoorCricket,
        playsPadel: !!player.playsPadel,
        playsPickleball: !!player.playsPickleball,
        areasPreferred: Array.isArray(player.areasPreferred) ? player.areasPreferred : [],
        psnOnlineId: player.psnOnlineId,
        xboxGamertag: player.xboxGamertag,
        roles: {
          cs2Role: player.cs2Role,
          cs16Role: player.cs16Role,
          valorantRole: player.valorantRole,
          fc26Role: player.fc26Role,
          padelRole: player.padelRole,
          pickleballRole: player.pickleballRole,
          futsalRole: (Array.isArray(player.futsalPositions) ? player.futsalPositions.filter(Boolean)[0] : null) || player.futsalPosition,
          indoor_cricketRole: player.indoorCricketRole,
        },
        isFriend: friendIds.has(String(player._id)),
        hasPendingRequest: pendingIds.has(String(player._id)),
      }));
  },
});

export const listDiscoverMatchrooms = query({
  args: {
    viewerUserId: v.optional(v.id("users")),
    selectedGame: v.string(),
    searchQuery: v.string(),
    selectedSkill: v.string(),
    selectedFormat: v.string(),
    selectedRole: v.string(),
    selectedSeries: v.string(),
    selectedOvers: v.string(),
    selectedArea: v.string(),
    selectedSkillLevel: v.string(),
    selectedTimeline: v.string(),
    selectedOpenSlots: v.string(),
    selectedPriceRange: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx);
    const limit = getSafeDiscoverLimit(args.limit, 150, 1000);
    if (isDisabledPhysicalGame(args.selectedGame)) {
      return [];
    }

    const searchText = args.searchQuery.trim();
    const search = searchText.toLowerCase();
    const roomFetchLimit = getCandidateFetchLimit(limit, { min: 120, max: 1200 });
    const fetchBaseRooms = () =>
      args.selectedGame !== "all"
        ? ctx.db
          .query("matchrooms")
          .withIndex("by_game", (q) => q.eq("game", args.selectedGame))
          .take(roomFetchLimit)
        : ctx.db.query("matchrooms").withIndex("by_createdAt").order("desc").take(roomFetchLimit);
    const baseRooms = search
      ? uniqueRowsById(
        (
          await Promise.all([
            ctx.db
              .query("matchrooms")
              .withSearchIndex("search_title", (q) => {
                const query = q.search("title", searchText);
                return args.selectedGame !== "all" ? query.eq("game", args.selectedGame) : query;
              })
              .take(roomFetchLimit),
            ctx.db
              .query("matchrooms")
              .withSearchIndex("search_location", (q) => {
                const query = q.search("location", searchText);
                return args.selectedGame !== "all" ? query.eq("game", args.selectedGame) : query;
              })
              .take(roomFetchLimit),
            fetchBaseRooms(),
          ])
        ).flat(),
      )
      : await fetchBaseRooms();

    return baseRooms
      .filter((room: any) => !isRoomExpired(room))
      .filter((room: any) => !isDisabledPhysicalGame(room.game))
      .filter((room: any) => {
        if (!search) return true;
        return (
          String(room.title || "").toLowerCase().includes(search) ||
          String(room.game || "").toLowerCase().includes(search) ||
          String(room.location || "").toLowerCase().includes(search)
        );
      })
      .filter((room: any) => args.selectedGame === "all" || normalizeGameKey(room.game) === args.selectedGame)
      .filter((room: any) => {
        if (args.selectedSkill === "Any") return true;
        if (args.selectedGame === "cs2") {
          return String(room.skillLevel || "Any").includes(args.selectedSkill.replace("FACEIT ", ""));
        }
        if (args.selectedGame === "cs16" || args.selectedGame === "valorant") {
          return String(room.skillLevel || "Any") === args.selectedSkill;
        }
        return true;
      })
      .filter((room: any) => args.selectedFormat === "Any" || String(room.format || "").toLowerCase().includes(args.selectedFormat.toLowerCase()))
      .filter((room: any) => {
        if (args.selectedRole === "Any") return true;
        const slotsA = Array.isArray(room.slotsA) ? room.slotsA : [];
        const slotsB = Array.isArray(room.slotsB) ? room.slotsB : [];
        return [...slotsA, ...slotsB].some((slot: any) => slot.status === "open" && slot.role === args.selectedRole);
      })
      .filter((room: any) => {
        if (args.selectedSeries === "Any") return true;
        const series = String(room.seriesType || room.format || "").toUpperCase();
        return series.includes(args.selectedSeries);
      })
      .filter((room: any) => {
        if (args.selectedOvers === "Any") return true;
        const overs = room.overs != null ? String(room.overs) : String(room.format || "").match(/(\d+)\s*overs?/i)?.[1];
        return overs === args.selectedOvers;
      })
      .filter((room: any) => {
        if (args.selectedArea === "Any") return true;
        return String(room.location || "").toLowerCase().includes(args.selectedArea.toLowerCase());
      })
      .filter((room: any) => {
        if (args.selectedSkillLevel === "Any") return true;
        const roomSkillLevel = String(room.skillLevel || "Casual").toLowerCase();
        if (args.selectedSkillLevel === "Pro / Tournament") {
          return roomSkillLevel.includes("pro") || roomSkillLevel.includes("tournament");
        }
        return roomSkillLevel.includes(args.selectedSkillLevel.toLowerCase());
      })
      .filter((room: any) => args.selectedOpenSlots !== "Open Slots" || roomHasOpenSlots(room))
      .filter((room: any) => matchesRoomPriceRange(room, args.selectedPriceRange))
      .filter((room: any) => matchesTimeline(room, args.selectedTimeline))
      .slice(0, limit)
      .map((room: any) => ({ ...room, id: room._id }));
  },
});

export const listDiscoverTeams = query({
  args: {
    viewerUserId: v.id("users"),
    mode: v.union(v.literal("my"), v.literal("discover")),
    selectedGame: v.string(),
    searchQuery: v.string(),
    selectedTeamFilter: v.optional(v.string()),
    selectedTeamSize: v.optional(v.string()),
    selectedArea: v.optional(v.string()),
    selectedCompetitiveIntent: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireCurrentUser(ctx);
    const viewerUserId = actor.user._id;
    const limit = getSafeDiscoverLimit(args.limit, 50, 1000);
    if (isDisabledPhysicalGame(args.selectedGame)) {
      return [];
    }

    const teamFetchLimit = getCandidateFetchLimit(limit, { min: 100, max: 1200 });
    const search = args.searchQuery.trim().toLowerCase();
    const hydrateCaptainMap = async (teams: any[]) => {
      const captainIds = Array.from(
        new Set(teams.map((team) => team?.captainUid).filter(Boolean)),
      );
      const captains = await Promise.all(captainIds.map((captainId) => ctx.db.get(captainId)));
      return new Map(captains.filter(Boolean).map((captain: any) => [String(captain._id), captain]));
    };

    if (args.mode === "my") {
      const memberships = await ctx.db
        .query("teamMembers")
        .withIndex("by_userId", (q) => q.eq("odxerId", viewerUserId))
        .collect();
      const teamDocs = await Promise.all(memberships.map((membership) => ctx.db.get(membership.teamId)));
      const captainMap = await hydrateCaptainMap(teamDocs.filter(Boolean));

      return teamDocs
        .filter(isActiveTeam)
        .filter((team: any) => !isDisabledPhysicalGame(team.game))
        .filter((team: any) => args.selectedGame === "all" || normalizeGameKey(team.game) === args.selectedGame)
        .filter((team: any) => {
          if (!search) return true;
          return (
            String(team.name || "").toLowerCase().includes(search) ||
            String(team.game || "").toLowerCase().includes(search)
          );
        })
        .filter((team: any) => {
          if (!args.selectedArea || args.selectedArea === "Any") return true;
          const captain = captainMap.get(String(team.captainUid));
          return matchesAreaSelection(captain?.areasPreferred, args.selectedArea);
        })
        .slice(0, limit)
        .map((team: any) => ({ ...team, id: team._id, isRequested: false }));
    }

    const pendingRequests = await ctx.db
      .query("notifications")
      .withIndex("by_fromUid", (q) => q.eq("fromUid", viewerUserId))
      .order("desc")
      .collect();
    const requestedTeamIds = new Set(
      pendingRequests
        .filter((notification: any) => ACTIVE_TEAM_JOIN_REQUEST_TYPES.has(String(notification.type || "")))
        .filter(isActivePendingNotification)
        .map((notification: any) => String(notification.teamId || notification.data?.teamId || ""))
    );

    const viewerCaptainTeams = await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q) => q.eq("captainUid", viewerUserId))
      .collect();
    const viewerCaptainTeamIds = new Set(viewerCaptainTeams.map((team: any) => String(team._id)));
    const pendingChallenges = viewerCaptainTeamIds.size > 0
      ? await ctx.db
          .query("teamChallenges")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect()
      : [];
    const pendingChallengeByOpponentTeamId = new Map<string, string>();
    pendingChallenges
      .filter((challenge: any) => String(challenge.captainAUid || "") === String(viewerUserId))
      .filter((challenge: any) => viewerCaptainTeamIds.has(String(challenge.challengerTeamId)))
      .forEach((challenge: any) => {
        const opponentTeamId = String(challenge.opponentTeamId || "");
        if (opponentTeamId && !pendingChallengeByOpponentTeamId.has(opponentTeamId)) {
          pendingChallengeByOpponentTeamId.set(opponentTeamId, String(challenge._id));
        }
      });

    const fetchBaseTeams = () =>
      args.selectedGame !== "all"
        ? ctx.db.query("teams").withIndex("by_game", (q) => q.eq("game", args.selectedGame)).take(teamFetchLimit)
        : ctx.db.query("teams").order("desc").take(teamFetchLimit);
    const baseTeams = search
      ? uniqueRowsById(
        (
          await Promise.all([
            ctx.db
              .query("teams")
              .withSearchIndex("search_name", (q) => {
                const query = q.search("name", search);
                return args.selectedGame !== "all" ? query.eq("game", args.selectedGame) : query;
              })
              .take(teamFetchLimit),
            ctx.db
              .query("teams")
              .withIndex("by_nameLower", (q) =>
                q.gte("nameLower", search).lt("nameLower", `${search}\uffff`)
              )
              .take(teamFetchLimit),
            fetchBaseTeams(),
          ])
        ).flat(),
      )
      : await fetchBaseTeams();
    const captainMap = await hydrateCaptainMap(baseTeams);

    return baseTeams
      .filter(isActiveTeam)
      .filter((team: any) => !isDisabledPhysicalGame(team.game))
      .filter((team: any) => !Array.isArray(team.memberUids) || !team.memberUids.includes(String(viewerUserId)))
      .filter((team: any) => {
        if (!search) return true;
        return (
          String(team.name || "").toLowerCase().includes(search) ||
          String(team.game || "").toLowerCase().includes(search)
        );
      })
      .filter((team: any) => {
        if (args.selectedTeamFilter !== "Open Slots" && args.selectedTeamFilter !== "Recruiting Now") return true;
        const memberCount = team.memberUids?.length ?? team.memberCount ?? 0;
        return memberCount < (team.maxMembers || 0);
      })
      .filter((team: any) => {
        if (!args.selectedArea || args.selectedArea === "Any") return true;
        const captain = captainMap.get(String(team.captainUid));
        return matchesAreaSelection(captain?.areasPreferred, args.selectedArea);
      })
      .filter((team: any) => {
        const memberCount = team.memberUids?.length ?? team.memberCount ?? 0;
        if (args.selectedTeamSize === "1-2 players") return memberCount >= 1 && memberCount <= 2;
        if (args.selectedTeamSize === "3-5 players") return memberCount >= 3 && memberCount <= 5;
        if (args.selectedTeamSize === "Full Team") return memberCount === (team.maxMembers || 0);
        return true;
      })
      .filter((team: any) => {
        if (!args.selectedCompetitiveIntent || args.selectedCompetitiveIntent === "Any") return true;
        const teamLevel = String(team.competitiveLevel || "Casual").toLowerCase();
        return teamLevel.includes(args.selectedCompetitiveIntent.toLowerCase().replace("-focused", ""));
      })
      .slice(0, limit)
      .map((team: any) => ({
        ...team,
        id: team._id,
        isRequested: requestedTeamIds.has(String(team._id)),
        pendingChallengeId: pendingChallengeByOpponentTeamId.get(String(team._id)) || null,
      }));
  },
});

export const listDiscoverZones = query({
  args: {
    selectedVenueType: v.union(v.literal("all"), v.literal("zones"), v.literal("courts")),
    selectedGame: v.string(),
    searchQuery: v.string(),
    selectedProximity: v.string(),
    selectedArea: v.string(),
    selectedPriceRange: v.string(),
    selectedPlatform: v.string(),
    userArea: v.optional(v.string()),
    userCity: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = getSafeDiscoverLimit(args.limit, 100, 1000);
    if (isDisabledPhysicalGame(args.selectedGame) || args.selectedVenueType === "courts") {
      return [];
    }

    const zoneFetchLimit = getCandidateFetchLimit(limit, { min: 40, max: 1200, multiplier: 2 });
    const searchText = args.searchQuery.trim();
    const search = searchText.toLowerCase();
    const fetchActiveZones = () =>
      ctx.db
        .query("zones")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .order("desc")
        .take(zoneFetchLimit);
    const zones = search
      ? uniqueRowsById(
        (
          await Promise.all([
            ctx.db
              .query("zones")
              .withSearchIndex("search_name", (q) => q.search("name", searchText).eq("status", "active"))
              .take(zoneFetchLimit),
            ctx.db
              .query("zones")
              .withSearchIndex("search_venueBrandName", (q) =>
                q.search("venueBrandName", searchText).eq("status", "active")
              )
              .take(zoneFetchLimit),
            ctx.db
              .query("zones")
              .withSearchIndex("search_city", (q) => q.search("city", searchText).eq("status", "active"))
              .take(zoneFetchLimit),
            ctx.db
              .query("zones")
              .withSearchIndex("search_address", (q) => q.search("address", searchText).eq("status", "active"))
              .take(zoneFetchLimit),
            ctx.db
              .query("zones")
              .withSearchIndex("search_primaryBranch_areaLabel", (q) =>
                q.search("primaryBranch.areaLabel", searchText).eq("status", "active")
              )
              .take(zoneFetchLimit),
            ctx.db
              .query("zones")
              .withSearchIndex("search_primaryBranch_addressLine1", (q) =>
                q.search("primaryBranch.addressLine1", searchText).eq("status", "active")
              )
              .take(zoneFetchLimit),
            fetchActiveZones(),
          ])
        ).flat(),
      )
      : await fetchActiveZones();
    const normalizedArea = String(args.userArea || "").trim().toLowerCase();
    const normalizedCity = String(args.userCity || "").trim().toLowerCase();

    const matchesGame = (zone: any) => {
      if (args.selectedGame === "all") return zoneHasEnabledGame(zone);
      const games = zone.games;
      if (Array.isArray(games)) {
        const gameSet = getGameSet(games);
        if (isPcSetupGame(args.selectedGame)) {
          return PC_SETUP_GAME_KEYS.some((key) => gameSet.has(key));
        }
        return gameSet.has(normalizeGameKey(args.selectedGame));
      }

      const flags = games || {};
      switch (normalizeGameKey(args.selectedGame)) {
        case "cs2":
        case "cs16":
        case "valorant":
          return flags.supportsCs2 === true || flags.supportsCs16 === true || flags.supportsValorant === true;
        case "fc26":
          return flags.supportsFc26 === true || flags.supportsFc25 === true;
        case "tekken8":
          return flags.supportsTekken8 === true;
        default:
          return true;
      }
    };

    return zones
      .filter((zone: any) => {
        if (zone.type === "sports") return false;
        if (args.selectedVenueType === "zones") return zone.type !== "sports";
        // Physical sports are temporarily disabled.
        // if (args.selectedVenueType === "courts") return zone.type !== "gaming";
        return true;
      })
      .filter(matchesGame)
      .filter((zone: any) => {
        if (!search) return true;
        const branch = getZonePreferredBranch(zone);
        return (
          String(zone.venueBrandName || zone.name || "").toLowerCase().includes(search) ||
          String(branch?.city || zone.city || "").toLowerCase().includes(search) ||
          String(branch?.areaLabel || "").toLowerCase().includes(search) ||
          String(branch?.addressLine1 || branch?.address || zone.address || "").toLowerCase().includes(search)
        );
      })
      .filter((zone: any) => {
        const branch = getZonePreferredBranch(zone);
        const zoneArea = String(branch?.areaLabel || "").toLowerCase();
        const zoneCity = String(branch?.city || zone.city || "").toLowerCase();
        if (args.selectedProximity === "Same Area" && normalizedArea) return zoneArea.includes(normalizedArea);
        if (args.selectedProximity === "Same City" && normalizedCity) return zoneCity.includes(normalizedCity);
        return true;
      })
      .filter((zone: any) => matchesAreaSelection(getZonePreferredBranch(zone)?.areaLabel, args.selectedArea))
      .filter((zone: any) => matchesVenuePriceRange(zone, args.selectedPriceRange, args.selectedGame))
      .filter((zone: any) => {
        const needsPlatform = args.selectedGame === "fc26" || args.selectedGame === "tekken8";
        return !needsPlatform || matchesVenuePlatform(zone, args.selectedPlatform);
      })
      .slice(0, limit)
      .map((zone: any) => ({ ...zone, id: zone._id }));
  },
});
