// src/services/convex/externalApiService.ts
// Convex-based external API service wrappers for Steam, FACEIT, and PSN
// Matches the interface of the original Firebase services

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

// ============================================
// STEAM
// ============================================

export interface SteamProfileSummary {
  steamId: string;
  personaName: string;
  avatarUrl?: string;
  countryCode?: string;
  cs2Hours?: number | null;
  stats?: {
    totalKills?: number;
    totalDeaths?: number;
    totalWins?: number;
    totalDamage?: number;
    kdRatio?: number | string;
  } | null;
}

type SteamResult =
  | { ok: true; data: SteamProfileSummary }
  | { ok: false; message: string };

export async function fetchSteamProfileFromUrl(
  url: string
): Promise<SteamResult> {
  try {
    const result: any = await convex.action(api.externalApis.fetchSteamProfile, { url });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
      };
    }
    return {
      ok: true,
      data: {
        steamId: result.steamId,
        personaName: result.personaName,
        avatarUrl: result.avatarUrl,
        countryCode: result.countryCode ?? undefined,
        cs2Hours: result.cs2Hours,
        stats: result.stats,
      },
    };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || "Failed to fetch Steam profile",
    };
  }
}

// ============================================
// FACEIT
// ============================================

export interface FaceitProfileSummary {
  faceitId: string;
  nickname: string;
  game: string;
  elo?: number | null;
  skillLevel?: number | null;
  country?: string | null;
  avatarUrl?: string | null;
}

type FaceitResult =
  | { ok: true; data: FaceitProfileSummary }
  | { ok: false; message: string };

export async function fetchFaceitProfileFromUrl(
  url: string,
  game: string = "cs2"
): Promise<FaceitResult> {
  try {
    const result = await convex.action(api.externalApis.fetchFaceitProfile, {
      value: url,
      game,
    });
    return {
      ok: true,
      data: {
        faceitId: result.faceitId,
        nickname: result.nickname,
        game: result.game || game,
        elo: result.elo,
        skillLevel: result.skillLevel,
        country: result.country,
        avatarUrl: result.avatarUrl,
      },
    };
  } catch (error: any) {
    console.error("[externalApiService] fetchFaceitProfile error:", error);
    return {
      ok: false,
      message: error?.message || "Failed to fetch FACEIT profile",
    };
  }
}

// ============================================
// PSN
// ============================================

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
  playDuration?: string | null;
  formatPlayDuration?: string | null;
}

export interface PsnVerificationResult {
  psnOnlineId: string;
  psnAccountId: string;
  avatarUrl?: string;
  profileUrl?: string;
  trophyLevel?: string;
  trophyTier?: string;
  totalTrophies?: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  tekken8: PsnGameStats;
  fc: PsnGameStats;
  psnLastSyncedAt?: string;
}

type PsnResult =
  | { ok: true; data: PsnVerificationResult }
  | { ok: false; message: string };

export async function verifyPsnProfile(
  psnOnlineId: string,
  wantsTekken: boolean = true,
  wantsFc: boolean = true
): Promise<PsnResult> {
  try {
    const result = await convex.action(api.externalApis.verifyPsnProfile, {
      psnOnlineId,
      wantsTekken,
      wantsFc,
    });
    return {
      ok: true,
      data: result as PsnVerificationResult,
    };
  } catch (error: any) {
    console.error("[externalApiService] verifyPsnProfile error:", error);
    return {
      ok: false,
      message: error?.message || "Failed to verify PSN profile",
    };
  }
}
