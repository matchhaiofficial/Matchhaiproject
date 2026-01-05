import { API_BASE_URL } from "../config/apiConfig";

export interface PsnGameStats {
    present: boolean;
    progress: number | null;
    earnedTrophies: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
    } | null;
    lastPlayedDateTime: string | null;
    playDuration?: string | null; // e.g. "PT10H"
    formatPlayDuration?: string | null; // e.g. "10 hours"
}

export interface PsnVerificationResult {
    psnOnlineId: string;
    psnAccountId: string;
    avatarUrl?: string;
    profileUrl?: string; // psnprofiles.com link
    trophyLevel?: string;
    trophyTier?: string; // number or string
    totalTrophies?: {
        bronze: number;
        silver: number;
        gold: number;
        platinum: number;
    };
    tekken8: PsnGameStats;
    fc: PsnGameStats;
}

type PsnApiResult =
    | { ok: true; data: PsnVerificationResult }
    | { ok: false; message: string };

export async function verifyPsnProfile(
    psnOnlineId: string,
    wantsTekken: boolean,
    wantsFc: boolean
): Promise<PsnApiResult> {
    if (!psnOnlineId.trim()) {
        return { ok: false, message: "PSN Online ID is required" };
    }

    if (!API_BASE_URL) {
        if (__DEV__) {
            console.warn("[psnApi] No API_BASE_URL, returning mock.");
            return {
                ok: true,
                data: {
                    psnOnlineId: psnOnlineId,
                    psnAccountId: "mock-psn-id",
                    trophyLevel: "330",
                    trophyTier: "Bronze",
                    totalTrophies: { bronze: 500, silver: 100, gold: 20, platinum: 5 },
                    avatarUrl: "https://i.pravatar.cc/300?u=psn",
                    profileUrl: `https://psnprofiles.com/${psnOnlineId}`,
                    tekken8: {
                        present: wantsTekken,
                        progress: wantsTekken ? 65 : 0,
                        earnedTrophies: wantsTekken ? { bronze: 10, silver: 5, gold: 1, platinum: 0 } : null,
                        lastPlayedDateTime: new Date().toISOString(),
                        formatPlayDuration: wantsTekken ? "120h 30m" : null
                    },
                    fc: {
                        present: wantsFc,
                        progress: wantsFc ? 40 : 0,
                        earnedTrophies: wantsFc ? { bronze: 15, silver: 2, gold: 0, platinum: 0 } : null,
                        lastPlayedDateTime: new Date().toISOString(),
                        formatPlayDuration: wantsFc ? "10h" : null
                    }
                }
            };
        }
        return { ok: false, message: "Server not configured" };
    }

    console.log(`[psnApi] Requesting ${API_BASE_URL}/psn/verify for ${psnOnlineId}`);

    try {
        const res = await fetch(`${API_BASE_URL}/psn/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                psnOnlineId,
                wantsTekken,
                wantsFc
            }),
        });

        const json = await res.json();
        if (!res.ok) {
            return { ok: false, message: json.message || "PSN verification failed" };
        }

        return { ok: true, data: json.data };
    } catch (e) {
        console.error("[psnApi] error", e);
        return { ok: false, message: `Network error connecting to ${API_BASE_URL}` };
    }
}
