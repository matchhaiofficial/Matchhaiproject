const fs = require('fs');
const path = require('path');
const {
    exchangeNpssoForAccessCode,
    exchangeAccessCodeForAuthTokens,
    exchangeRefreshTokenForAuthTokens,
    makeUniversalSearch,
    getProfileFromUserName,
    getUserTitles,
    getUserTrophyGroupEarningsForTitle,
    getUserTrophiesEarnedForTitle,
    getUserTrophyProfileSummary,
    getUserPlayedGames
} = require("psn-api");

// Path to store tokens persistently
const TOKEN_FILE_PATH = path.join(__dirname, 'psn-tokens.json');
const { PSN_NPSSO } = process.env;

// In-memory token cache
let cachedAuth = null;

/**
 * Load tokens from disk
 */
function loadTokens() {
    if (cachedAuth) return cachedAuth;
    try {
        if (fs.existsSync(TOKEN_FILE_PATH)) {
            const data = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
            cachedAuth = JSON.parse(data);
            return cachedAuth;
        }
    } catch (e) {
        console.error("[psnService] Failed to load tokens", e);
    }
    return null;
}

/**
 * Save tokens to disk
 */
function saveTokens(authData) {
    cachedAuth = authData;
    try {
        fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(authData, null, 2));
    } catch (e) {
        console.error("[psnService] Failed to save tokens", e);
    }
}

/**
 * Get valid authorization header (refreshing if needed)
 */
async function getGlobalPsnAuthorization() {
    let authData = loadTokens();
    const now = new Date();

    // 1. Initial Exchange if no tokens
    if (!authData) {
        console.log("[psnService] No tokens found. Exchanging NPSSO...");
        if (!PSN_NPSSO) throw new Error("PSN_NPSSO env var is missing");

        const accessCode = await exchangeNpssoForAccessCode(PSN_NPSSO);
        const tokens = await exchangeAccessCodeForAuthTokens(accessCode);

        // Calculate expiry (expiresIn is seconds)
        const expiresAt = new Date(now.getTime() + tokens.expiresIn * 1000);

        authData = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: expiresAt.toISOString()
        };
        saveTokens(authData);
        return { accessToken: authData.accessToken };
    }

    // 2. Refresh if expired
    const expiresAt = new Date(authData.accessTokenExpiresAt);
    // Buffer of 5 minutes
    if (now.getTime() > expiresAt.getTime() - 5 * 60000) {
        console.log("[psnService] Access token expired. Refreshing...");
        const tokens = await exchangeRefreshTokenForAuthTokens(authData.refreshToken);

        const newExpiresAt = new Date(now.getTime() + tokens.expiresIn * 1000);
        authData = {
            ...authData,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            accessTokenExpiresAt: newExpiresAt.toISOString()
        };
        saveTokens(authData);
    }

    return { accessToken: authData.accessToken };
}

/**
 * Verify PSN ID and get stats for Tekken and FC
 */
const axios = require('axios');
const { PSN_SERVICE_URL } = process.env;

/**
 * Verify PSN ID and get stats for Tekken and FC
 */
async function verifyPsnForTekkenAndFc(psnOnlineId) {
    // 0. Use Microservice if configured
    if (PSN_SERVICE_URL) {
        console.log(`[psnService] Delegating verification to ${PSN_SERVICE_URL}...`);
        try {
            const res = await axios.post(PSN_SERVICE_URL, {
                psnOnlineId,
                wantsTekken: true,
                wantsFc: true
            });

            if (res.data && res.data.status === 'ok' && res.data.psn) {
                return res.data.psn;
            }
            throw new Error(res.data.message || "Unknown service error");
        } catch (e) {
            console.error("[psnService] External service failed", e.response ? e.response.data : e.message);
            // Optional: Fallback to local logic? 
            // For now, let's THROW so we know it failed, unless we want robust fallback.
            // If the user set the URL, they expect it to work.
            // But if it's just connectivity, maybe fallback is good?
            // "PSN User not found" from service should be final.
            if (e.response && e.response.status === 404) { // Not found
                throw new Error("PSN User not found or private.");
            }
            throw new Error(`PSN Service Error: ${e.message}`);
        }
    }

    const authorization = await getGlobalPsnAuthorization();

    console.log(`[psnService] Verifying ${psnOnlineId}...`);
    // ... Legacy logic below (I'll keep it for fallback if I didn't return above, but I returned or threw)

    // 1. Resolve Account ID
    let accountId = null;
    let summary = null;

    try {
        // Try explicit profile lookup first
        const profile = await getProfileFromUserName(authorization, psnOnlineId);
        console.log(`[psnService] Found profile via direct lookup: ${profile.accountId}`);
        accountId = profile.accountId;
    } catch (e) {
        console.error(`[psnService] getProfileFromUserName error:`, e);
        // Fallback search
        console.log("[psnService] Trying fallback search...");
        const search = await makeUniversalSearch(authorization, psnOnlineId, "SocialAllAccounts");

        if (search.domainResponses && search.domainResponses[0] && search.domainResponses[0].results) {
            const result = search.domainResponses[0].results[0];
            console.log(`[psnService] Search result:`, JSON.stringify(result, null, 2));

            if (result && result.socialMetadata && result.socialMetadata.onlineId.toLowerCase() === psnOnlineId.toLowerCase()) {
                accountId = result.socialMetadata.accountId;
            }
        } else {
            console.log("[psnService] Universal Search returned no results structure.");
        }
    }

    if (!accountId) {
        throw new Error("PSN User not found or private.");
    }

    // 2. Global Trophy Summary
    let trophySummary = {};
    try {
        const t = await getUserTrophyProfileSummary(authorization, accountId);
        trophySummary = {
            trophyLevel: t.trophyLevel,
            trophyTier: t.tier,
            totalTrophies: t.earnedTrophies
        };
    } catch (e) {
        console.log("[psnService] Trophy summary failed (likely private)", e.message);
    }

    // 3. Find Titles (Tekken 8 & FC)
    const stats = {
        tekken8: { present: false, progress: 0, earnedTrophies: null, lastPlayedDateTime: null },
        fc: { present: false, progress: 0, earnedTrophies: null, lastPlayedDateTime: null }
    };

    try {
        const { trophyTitles } = await getUserTitles(authorization, accountId, { limit: 800 });

        for (const title of trophyTitles) {
            const name = title.trophyTitleName.toLowerCase();

            let target = null;
            if (name.includes("tekken 8")) target = stats.tekken8;
            else if (name.includes("ea sports fc") && (name.includes("25") || name.includes("26"))) target = stats.fc;

            if (target && !target.present) {
                target.present = true;
                target.progress = title.progress;
                target.earnedTrophies = title.earnedTrophies;
                target.lastPlayedDateTime = title.lastUpdatedDateTime;
                // Note: lastUpdatedDateTime is when trophies changed, typically close to playtime for active users.
                // For deeper playtime, we'd need getUserPlayedGames but getUserTitles is often sufficient for "last active".
            }
        }
    } catch (e) {
        console.log("[psnService] getUserTitles failed", e.message);
    }

    return {
        psnOnlineId,
        psnAccountId: accountId,
        ...trophySummary,
        tekken8: stats.tekken8,
        fc: stats.fc
    };
}

module.exports = {
    verifyPsnForTekkenAndFc
};
