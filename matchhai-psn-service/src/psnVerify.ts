import {
    getProfileFromUserName,
    getUserPlayedGames,
    getUserTitles,
    getUserTrophyGroupEarningsForTitle,
    getUserTrophyProfileSummary,
    makeUniversalSearch, // Added
    TrophyTitle
} from "psn-api";
import { getGlobalPsnAuthorization } from "./psnAuth";
import { PsnGameStats, PsnVerificationResult, PsnVerifyRequest, TrophyCounts } from "./types";

// --- Helpers ---

// Helper to format ISO Duration (PT10H30M) to "10h 30m"
function formatDuration(isoDuration: string | undefined | null): string | null {
    if (!isoDuration) return null;
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?/);
    if (!match) return null;

    const h = match[1] ? match[1].replace("H", "h") : "";
    const m = match[2] ? match[2].replace("M", "m") : "";

    if (!h && !m) return null;
    return (h + " " + m).trim();
}

async function resolveAccount(accessToken: string, psnOnlineId: string): Promise<{ accountId: string, avatarUrl?: string }> {
    const authorization = { accessToken };

    // Try profile lookup first (gives extra info)
    try {
        const profileRes = await getProfileFromUserName(authorization, psnOnlineId) as any;
        const profile = profileRes.profile || profileRes;

        console.log(`[psnVerify] Profile props: ${Object.keys(profile).join(", ")}`);

        if (!profile.accountId) {
            console.log(`[psnVerify] Profile missing accountId. Full: ${JSON.stringify(profileRes)}`);
            throw new Error("Profile missing accountId");
        }

        // Extract avatar (use largest)
        let avatarUrl: string | undefined;
        if (profile.avatarUrls && profile.avatarUrls.length > 0) {
            avatarUrl = profile.avatarUrls[profile.avatarUrls.length - 1].avatarUrl;
        }

        return { accountId: profile.accountId, avatarUrl };
    } catch (err) {
        // fallback to universal search
        console.log(`[psnVerify] Direct profile lookup failed for ${psnOnlineId}, trying universal search...`, err);
    }

    const search = await makeUniversalSearch(
        authorization,
        psnOnlineId,
        "SocialAllAccounts"
    );

    const firstResult =
        search.domainResponses?.[0]?.results?.[0]?.socialMetadata;

    if (!firstResult?.accountId) {
        throw new Error("PSN user not found or not publicly searchable");
    }

    return { accountId: firstResult.accountId, avatarUrl: firstResult.avatarUrl };
}

async function fetchGlobalTrophySummary(accessToken: string, accountId: string) {
    const authorization = { accessToken };
    const summary = await getUserTrophyProfileSummary(authorization, accountId);

    const { trophyLevel, tier, earnedTrophies } = summary;

    // Safety check for private profiles
    const totalTrophies: TrophyCounts = earnedTrophies ? {
        bronze: earnedTrophies.bronze,
        silver: earnedTrophies.silver,
        gold: earnedTrophies.gold,
        platinum: earnedTrophies.platinum
    } : { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    return { trophyLevel: String(trophyLevel), tier: String(tier), totalTrophies };
}

type FoundTitle = {
    npCommunicationId: string;
    name: string;
    platform: string;
    progress: number;
    earnedTrophies: TrophyCounts;
    lastUpdatedDateTime: string;
};

function isTekkenTitleName(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes("tekken 8");
}

function isFcTitleName(name: string): boolean {
    const lower = name.toLowerCase();
    // Covers "EA SPORTS FC 25", "FC 25", "FC 26" etc.
    return lower.includes("ea sports fc") || (lower.includes("fc") && (lower.includes("25") || lower.includes("26")));
}

function extractTekkenAndFcTitles(trophyTitles: TrophyTitle[]): { tekken?: FoundTitle, fc?: FoundTitle } {
    let tekken: FoundTitle | undefined;
    let fc: FoundTitle | undefined;

    for (const t of trophyTitles) {
        if (!t.trophyTitleName) continue;

        if (!tekken && isTekkenTitleName(t.trophyTitleName)) {
            tekken = {
                npCommunicationId: t.npCommunicationId,
                name: t.trophyTitleName,
                platform: t.trophyTitlePlatform,
                progress: t.progress,
                earnedTrophies: t.earnedTrophies,
                lastUpdatedDateTime: t.lastUpdatedDateTime
            };
        }

        if (!fc && isFcTitleName(t.trophyTitleName)) {
            fc = {
                npCommunicationId: t.npCommunicationId,
                name: t.trophyTitleName,
                platform: t.trophyTitlePlatform,
                progress: t.progress,
                earnedTrophies: t.earnedTrophies,
                lastUpdatedDateTime: t.lastUpdatedDateTime
            };
        }

        if (tekken && fc) break;
    }

    return { tekken, fc };
}

async function buildGameStatsForTitle(
    authorization: { accessToken: string },
    accountId: string,
    title: FoundTitle,
    playDuration?: string | null
): Promise<PsnGameStats> {
    const npServiceName = title.platform.includes("PS5") ? "trophy2" : "trophy";

    const formattedDuration = formatDuration(playDuration);

    try {
        const { progress, earnedTrophies, lastUpdatedDateTime } =
            await getUserTrophyGroupEarningsForTitle(
                authorization,
                accountId,
                title.npCommunicationId,
                { npServiceName }
            );

        return {
            present: true,
            progress: progress ?? 0,
            earnedTrophies: {
                bronze: earnedTrophies.bronze,
                silver: earnedTrophies.silver,
                gold: earnedTrophies.gold,
                platinum: earnedTrophies.platinum
            },
            lastPlayedDateTime: lastUpdatedDateTime ?? title.lastUpdatedDateTime ?? null,
            playDuration: playDuration,
            formatPlayDuration: formattedDuration
        };
    } catch (e) {
        console.warn(`[psnVerify] Failed to get detailed stats for ${title.name}`, e);
        // Fallback to title info
        return {
            present: true,
            progress: title.progress ?? 0,
            earnedTrophies: title.earnedTrophies,
            lastPlayedDateTime: title.lastUpdatedDateTime,
            playDuration,
            formatPlayDuration: formattedDuration
        };
    }
}

// --- Main Verification Function ---

export async function verifyPsnForTekkenAndFc(req: PsnVerifyRequest): Promise<PsnVerificationResult> {
    const wantsTekken = !!req.wantsTekken;
    const wantsFc = !!req.wantsFc;

    if (!wantsTekken && !wantsFc) {
        throw new Error("At least one of Tekken or FC must be requested");
    }

    const { accessToken } = await getGlobalPsnAuthorization();
    const authorization = { accessToken };

    const { accountId, avatarUrl } = await resolveAccount(accessToken, req.psnOnlineId);

    // global trophies
    const { trophyLevel, tier, totalTrophies } = await fetchGlobalTrophySummary(accessToken, accountId);

    // titles (trophies)
    console.log(`[psnVerify] Fetching titles for ${accountId}...`);
    const titlesRes = await getUserTitles(authorization, accountId, { limit: 800 });
    console.log(`[psnVerify] Fetched ${titlesRes?.trophyTitles?.length ?? 0} titles.`);
    if (titlesRes?.trophyTitles?.length > 0) {
        console.log(`[psnVerify] First title: ${titlesRes.trophyTitles[0].trophyTitleName}`);
    } else {
        console.log(`[psnVerify] No titles found. Response keys: ${Object.keys(titlesRes || {}).join(", ")}`);
    }

    const { tekken, fc } = extractTekkenAndFcTitles(titlesRes.trophyTitles || []);

    // playtime (played games - only fetch if we found games and need playtime)
    const playedGamesRes = await getUserPlayedGames(authorization, accountId, { limit: 200, offset: 0 }).catch(e => {
        console.warn("[psnVerify] getUserPlayedGames failed (likely private)", e.message);
        return { domainResponses: [] } as any;
    });

    // Map durations
    // getUserPlayedGames returns { domainResponses: [ { results: [ ... ] } ] }
    const playedGames = (playedGamesRes as any).domainResponses?.[0]?.results || [];

    let tekkenDuration: string | null = null;
    let fcDuration: string | null = null;

    console.log(`[psnVerify] Checking ${playedGames.length} played games for duration data...`);

    for (const g of playedGames) {
        if (!tekkenDuration && isTekkenTitleName(g.name || "")) {
            tekkenDuration = g.playDuration;
            console.log(`[psnVerify] Found Tekken game: ${g.name}, playDuration: ${g.playDuration || 'NULL'}`);
        }
        if (!fcDuration && isFcTitleName(g.name || "")) {
            fcDuration = g.playDuration;
            console.log(`[psnVerify] Found FC game: ${g.name}, playDuration: ${g.playDuration || 'NULL'}`);
        }
    }

    const tekkenStats: PsnGameStats = tekken && wantsTekken
        ? await buildGameStatsForTitle(authorization, accountId, tekken, tekkenDuration)
        : { present: false, progress: null, earnedTrophies: null, lastPlayedDateTime: null };

    const fcStats: PsnGameStats = fc && wantsFc
        ? await buildGameStatsForTitle(authorization, accountId, fc, fcDuration)
        : { present: false, progress: null, earnedTrophies: null, lastPlayedDateTime: null };

    return {
        psnOnlineId: req.psnOnlineId,
        psnAccountId: accountId,
        avatarUrl,
        profileUrl: `https://psnprofiles.com/${req.psnOnlineId}`,
        trophyLevel,
        trophyTier: tier,
        totalTrophies,
        tekken8: tekkenStats,
        fc: fcStats,
        psnLastSyncedAt: new Date().toISOString()
    };
}
