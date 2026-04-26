"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================
// STEAM API
// ============================================

const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Extract Steam ID from various URL formats
function extractSteamIdOrVanity(input: string): { type: "id" | "vanity"; value: string } {
  const trimmed = input.trim();

  // Direct steamID64 (17 digits starting with 7656)
  if (/^7656\d{13}$/.test(trimmed)) {
    return { type: "id", value: trimmed };
  }

  // URL patterns
  const profilesMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/);
  if (profilesMatch) {
    return { type: "id", value: profilesMatch[1] };
  }

  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^\/\?]+)/);
  if (idMatch) {
    return { type: "vanity", value: idMatch[1] };
  }

  // Assume it's a vanity name
  return { type: "vanity", value: trimmed };
}

export const fetchSteamProfile = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    if (!STEAM_API_KEY) {
      throw new Error("STEAM_API_KEY is not configured");
    }

    const { type, value } = extractSteamIdOrVanity(args.url);
    let steamId = value;

    // Resolve vanity URL if needed
    if (type === "vanity") {
      const resolveUrl = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${value}`;
      const resolveRes = await fetch(resolveUrl);
      const resolveData = await resolveRes.json();

      if (resolveData.response?.success !== 1) {
        throw new Error("Could not resolve Steam vanity URL");
      }
      steamId = resolveData.response.steamid;
    }

    // Get player summary
    const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamId}`;
    const summaryRes = await fetch(summaryUrl);
    const summaryData = await summaryRes.json();

    const player = summaryData.response?.players?.[0];
    if (!player) {
      throw new Error("Steam profile not found");
    }

    // Get owned games for CS2 hours
    const gamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
    const gamesRes = await fetch(gamesUrl);
    const gamesData = await gamesRes.json();

    const cs2Game = gamesData.response?.games?.find(
      (g: any) => g.appid === 730 // CS2/CSGO AppID
    );
    const cs2Hours = cs2Game ? Math.round(cs2Game.playtime_forever / 60) : null;

    // Get CS2 stats
    let stats = null;
    try {
      const statsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/?key=${STEAM_API_KEY}&steamid=${steamId}&appid=730`;
      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();

      if (statsData.playerstats?.stats) {
        const statMap = new Map(
          statsData.playerstats.stats.map((s: any) => [s.name, s.value])
        );
        const kills = Number(statMap.get("total_kills") || 0);
        const deaths = Number(statMap.get("total_deaths") || 1);

        stats = {
          totalKills: kills,
          totalDeaths: deaths,
          totalWins: Number(statMap.get("total_wins") || 0),
          totalDamage: Number(statMap.get("total_damage_done") || 0),
          kdRatio: deaths > 0 ? (kills / deaths).toFixed(2) : "N/A",
        };
      }
    } catch (e) {
      // Stats may be private
      console.log("[Steam] Could not fetch stats - likely private profile");
    }

    return {
      steamId,
      personaName: player.personaname,
      avatarUrl: player.avatarfull || player.avatar,
      countryCode: player.loccountrycode || null,
      cs2Hours,
      stats,
    };
  },
});

// ============================================
// FACEIT API
// ============================================

const FACEIT_API_KEY = process.env.FACEIT_API_KEY;
const ANTIDEO_API_KEY = process.env.ANTIDEO_API_KEY;

export const fetchFaceitProfile = action({
  args: {
    value: v.string(),
    game: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!FACEIT_API_KEY) {
      throw new Error("FACEIT_API_KEY is not configured");
    }

    // Extract nickname from URL or use directly
    let nickname = args.value.trim();
    const urlMatch = nickname.match(/faceit\.com\/.*\/players\/([^\/\?]+)/);
    if (urlMatch) {
      nickname = urlMatch[1];
    }

    const game = args.game || "cs2";

    const apiUrl = `https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(nickname)}&game=${game}`;

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${FACEIT_API_KEY}`,
      },
    });

    if (!res.ok) {
      throw new Error("FACEIT player not found");
    }

    const data = await res.json();

    // Extract game-specific stats
    const gameStats = data.games?.[game];

    return {
      faceitId: data.player_id,
      nickname: data.nickname,
      game,
      elo: gameStats?.faceit_elo || null,
      skillLevel: gameStats?.skill_level || null,
      country: data.country || null,
      avatarUrl: data.avatar || null,
    };
  },
});

// ============================================
// PHONE VALIDATION
// ============================================

const isE164Phone = (value: string) => /^\+\d{8,15}$/.test(value);

export const validatePhoneNumber = action({
  args: {
    phone: v.string(),
    countryCode: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    if (!ANTIDEO_API_KEY) {
      throw new Error("ANTIDEO_API_KEY is not configured");
    }

    const normalized = String(args.phone || "").trim();
    if (!normalized) {
      throw new Error("Phone number is required");
    }

    const countryCode = String(args.countryCode || "PK").trim().toLowerCase();
    const basePath = isE164Phone(normalized)
      ? `https://api.antideo.com/phone/${encodeURIComponent(normalized)}`
      : `https://api.antideo.com/phone/${countryCode}/${encodeURIComponent(normalized)}`;

    const requestOptions = {
      method: "GET",
      headers: {
        "x-api-key": ANTIDEO_API_KEY,
        "api-key": ANTIDEO_API_KEY,
        apikey: ANTIDEO_API_KEY,
        "Api-Key": ANTIDEO_API_KEY,
        Authorization: `Bearer ${ANTIDEO_API_KEY}`,
        Accept: "application/json",
      },
    } as const;

    let response = await fetch(basePath, requestOptions);

    if (response.status === 401) {
      response = await fetch(`${basePath}?apiKey=${encodeURIComponent(ANTIDEO_API_KEY)}`, requestOptions);
    }

    if (response.status === 401) {
      response = await fetch(`${basePath}&apiKey=${encodeURIComponent(ANTIDEO_API_KEY)}`, requestOptions);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Phone validation failed: ${response.status} ${body}`);
    }

    const result = await response.json();
    return {
      phone: result.phone || normalized,
      valid: Boolean(result.valid),
      type: result.type || null,
      carrier: result.carrier || null,
      location: result.location || null,
      formats: result.formats || null,
    };
  },
});

// ============================================
// PSN API
// ============================================

// PSN requires the psn-api library which needs special handling
// We'll store tokens in the database for persistence

import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  makeUniversalSearch,
  getUserTrophyProfileSummary,
  getUserTitles,
} from "psn-api";

const PSN_NPSSO = process.env.PSN_NPSSO;

// Helper to get or refresh PSN auth
async function getPsnAuth(ctx: any): Promise<{ accessToken: string }> {
  // Try to get cached token
  const cached = await ctx.runQuery(internal.psnTokenCache.getPsnTokenCache, {});

  if (cached && cached.expiresAt > Date.now() + 60000) {
    return { accessToken: cached.accessToken };
  }

  // Need to refresh or get new token
  if (cached && cached.refreshToken) {
    try {
      console.log("[PSN] Refreshing access token...");
      const refreshed = await exchangeRefreshTokenForAuthTokens(cached.refreshToken);
      const expiresAt = Date.now() + (refreshed.expiresIn || 3600) * 1000;

      await ctx.runMutation(internal.psnTokenCache.updatePsnTokenCache, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt,
      });

      return { accessToken: refreshed.accessToken };
    } catch (e) {
      console.log("[PSN] Refresh failed, getting new token");
    }
  }

  // Get new token from NPSSO
  if (!PSN_NPSSO) {
    throw new Error("PSN_NPSSO is not configured");
  }

  console.log("[PSN] Exchanging NPSSO for new tokens...");
  const accessCode = await exchangeNpssoForAccessCode(PSN_NPSSO);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  const expiresAt = Date.now() + (tokens.expiresIn || 3600) * 1000;

  await ctx.runMutation(internal.psnTokenCache.updatePsnTokenCache, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
  });

  return { accessToken: tokens.accessToken };
}

export const verifyPsnProfile = action({
  args: {
    psnOnlineId: v.string(),
    wantsTekken: v.optional(v.boolean()),
    wantsFc: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { accessToken } = await getPsnAuth(ctx);
    const authorization = { accessToken };

    // Get profile
    let accountId: string;
    let avatarUrl: string | undefined;

    try {
      const profile = (await getProfileFromUserName(
        authorization,
        args.psnOnlineId
      )) as any;
      accountId = profile.accountId;
      avatarUrl = profile.avatarUrls?.[0]?.avatarUrl;

      // Validate that accountId was found
      if (!accountId) {
        throw new Error("PSN profile found but account ID is missing");
      }
    } catch (e: any) {
      console.log("[PSN] Direct lookup failed, trying search...", e?.message);

      const search = await makeUniversalSearch(
        authorization,
        args.psnOnlineId,
        "SocialAllAccounts"
      );

      const result = (search as any)?.domainResponses?.[0]?.results?.[0];
      if (!result?.socialMetadata?.accountId) {
        throw new Error("PSN user not found or not publicly searchable");
      }

      accountId = result.socialMetadata.accountId;
      avatarUrl = result.socialMetadata.avatarUrl;
    }

    // Final validation
    if (!accountId) {
      throw new Error("Failed to retrieve PSN account ID");
    }

    // Get trophy summary
    let trophyLevel = "0";
    let trophyTier = "0";
    let totalTrophies = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    try {
      const trophySummary = await getUserTrophyProfileSummary(
        authorization,
        accountId
      );
      trophyLevel = String(trophySummary.trophyLevel);
      trophyTier = String((trophySummary as any).trophyTier || 0);
      totalTrophies = {
        bronze: trophySummary.earnedTrophies.bronze,
        silver: trophySummary.earnedTrophies.silver,
        gold: trophySummary.earnedTrophies.gold,
        platinum: trophySummary.earnedTrophies.platinum,
      };
    } catch (e) {
      console.log("[PSN] Trophy summary failed (likely private)");
    }

    // Get game titles
    let tekken8 = { present: false, progress: null as number | null, earnedTrophies: null as any, lastPlayedDateTime: null as string | null, playDuration: null as string | null, formatPlayDuration: null as string | null };
    let fc = { present: false, progress: null as number | null, earnedTrophies: null as any, lastPlayedDateTime: null as string | null, playDuration: null as string | null, formatPlayDuration: null as string | null };

    try {
      const titles = await getUserTitles(authorization, accountId, {
        limit: 800,
      });

      for (const title of titles.trophyTitles || []) {
        const name = title.trophyTitleName.toLowerCase();

        if (args.wantsTekken && name.includes("tekken 8")) {
          tekken8 = {
            present: true,
            progress: title.progress,
            earnedTrophies: title.earnedTrophies as any,
            lastPlayedDateTime: title.lastUpdatedDateTime,
            playDuration: null,
            formatPlayDuration: null,
          };
        }

        if (args.wantsFc && (name.includes("ea sports fc") || name.includes("fc 25") || name.includes("fc 26"))) {
          fc = {
            present: true,
            progress: title.progress,
            earnedTrophies: title.earnedTrophies as any,
            lastPlayedDateTime: title.lastUpdatedDateTime,
            playDuration: null,
            formatPlayDuration: null,
          };
        }
      }
    } catch (e) {
      console.log("[PSN] Get titles failed");
    }

    return {
      psnOnlineId: args.psnOnlineId,
      psnAccountId: accountId,
      avatarUrl,
      profileUrl: `https://psnprofiles.com/${args.psnOnlineId}`,
      trophyLevel,
      trophyTier,
      totalTrophies,
      tekken8,
      fc,
      psnLastSyncedAt: new Date().toISOString(),
    };
  },
});

