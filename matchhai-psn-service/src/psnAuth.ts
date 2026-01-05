import {
    exchangeAccessCodeForAuthTokens,
    exchangeNpssoForAccessCode,
    exchangeRefreshTokenForAuthTokens
} from "psn-api";

type PsnGlobalAuth = {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: string;    // ISO date
    refreshTokenExpiresAt?: string;  // optional
};

// In-memory storage for serverless runtime (reused if hot)
let globalAuth: PsnGlobalAuth | null = null;

export async function getGlobalPsnAuthorization(): Promise<{ accessToken: string }> {
    const now = new Date();

    // 1. If no globalAuth in memory, bootstrap from NPSSO
    if (!globalAuth) {
        const npsso = process.env.PSN_NPSSO;
        if (!npsso) throw new Error("PSN_NPSSO env var is missing");

        console.log("[psnAuth] Performing initial exchange with NPSSO...");
        const accessCode = await exchangeNpssoForAccessCode(npsso);
        const auth = await exchangeAccessCodeForAuthTokens(accessCode);

        const accessTokenExpiresAt = new Date(
            now.getTime() + auth.expiresIn * 1000
        ).toISOString();

        const refreshTokenExpiresAt = auth.refreshTokenExpiresIn
            ? new Date(now.getTime() + auth.refreshTokenExpiresIn * 1000).toISOString()
            : undefined;

        globalAuth = {
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
            accessTokenExpiresAt,
            refreshTokenExpiresAt
        };

        return { accessToken: globalAuth.accessToken };
    }

    // 2. If access token expired, refresh via refreshToken
    // Buffer of 60 seconds
    if (new Date(globalAuth.accessTokenExpiresAt).getTime() <= (now.getTime() + 60000)) {
        console.log("[psnAuth] Access token expired/expiring. Refreshing...");
        const updated = await exchangeRefreshTokenForAuthTokens(globalAuth.refreshToken);

        const accessTokenExpiresAt = new Date(
            now.getTime() + updated.expiresIn * 1000
        ).toISOString();

        const refreshTokenExpiresAt = updated.refreshTokenExpiresIn
            ? new Date(now.getTime() + updated.refreshTokenExpiresIn * 1000).toISOString()
            : globalAuth.refreshTokenExpiresAt;

        globalAuth = {
            accessToken: updated.accessToken,
            refreshToken: updated.refreshToken,
            accessTokenExpiresAt,
            refreshTokenExpiresAt
        };
    }

    return { accessToken: globalAuth.accessToken };
}
