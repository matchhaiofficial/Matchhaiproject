import { useConvexAuth, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { Id } from "../../convex/_generated/dataModel";
import { isAuthenticatedProfileReady } from "../utils/authReadiness";

const PC_SETUP_GAME_KEYS = ["cs2", "cs16", "valorant"] as const;

function normalizeGameKey(value: unknown) {
    const normalized = String(value || "").trim().toLowerCase();
    const compact = normalized.replace(/[\s._-]+/g, "");
    if (compact === "fc25" || compact === "fc26") return "fc26";
    if (compact === "cs2" || compact === "cs16" || compact === "counterstrike16") return compact === "cs2" ? "cs2" : "cs16";
    if (compact === "valorant" || compact === "tekken8") return compact;
    return normalized;
}

function buildGameFlagsFromArray(games: unknown[]) {
    const gameSet = new Set(games.map(normalizeGameKey).filter(Boolean));
    const hasPcSetup = PC_SETUP_GAME_KEYS.some((key) => gameSet.has(key));

    return {
        supportsCs2: hasPcSetup,
        supportsCs16: hasPcSetup,
        supportsValorant: hasPcSetup,
        supportsFc25: gameSet.has("fc26"),
        supportsFc26: gameSet.has("fc26"),
        supportsTekken8: gameSet.has("tekken8"),
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
    };
}

/**
 * Transform Convex zone document to the shape expected by zone admin screens.
 */
function transformZone(zone: any): any {
    const ownerDisplayName = String(zone.ownerFullName || "").trim();
    const ownerUsername = String(zone.ownerUsername || "").trim();
    const resolvedOwnerName = ownerDisplayName || (ownerUsername.startsWith("user_") ? "" : ownerUsername);

    // Handle games array vs object format
    let gamesObj = zone.games;
    if (Array.isArray(zone.games)) {
        gamesObj = buildGameFlagsFromArray(zone.games);
    }

    return {
        id: zone._id,
        _id: zone._id,
        ownerUid: zone.ownerUid,
        ownerFullName: resolvedOwnerName || undefined,
        venueBrandName: zone.venueBrandName || zone.name,
        contactEmail: zone.contactEmail,
        contactPhone: zone.contactPhone || zone.phone,
        type: zone.type || "gaming",
        primaryBranch: zone.primaryBranch || (zone.branches?.[0] ? {
            branchDisplayName: zone.branches[0].name || zone.branches[0].branchDisplayName,
            city: zone.branches[0].city || zone.city,
            areaLabel: zone.branches[0].areaLabel,
            addressLine1: zone.branches[0].address || zone.branches[0].addressLine1,
            googleMapsUrl: zone.branches[0].googleMapsUrl,
        } : undefined),
        branches: zone.branches || [],
        games: gamesObj,
        pricing: zone.pricing,
        capacity: zone.capacity,
        hourlyRate: zone.hourlyRate || zone.defaultPricing?.hourlyRate,
        ps5HourlyRate: zone.ps5HourlyRate,
        status: zone.status,
        rejectionReason: zone.rejectionReason,
        createdAt: zone.createdAt,
        updatedAt: zone.updatedAt,
        onboardingStep: zone.onboardingStep,
        migration: zone.migration,
    };
}

export function useZoneData() {
    const { user, authUser, loading: authLoading } = useAuth();
    const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
    const protectedQueryReady = isAuthenticatedProfileReady({
        authLoading,
        convexAuthLoading,
        isAuthenticated,
        authUserId: authUser?.id,
        profileAuthId: user?.authId,
        profileUserId: user?._id,
    });

    const rawZone = useQuery(
        api.zones.getByOwner,
        protectedQueryReady && user?._id ? { ownerUid: user._id as Id<"users"> } : "skip",
    );

    const loading =
        authLoading ||
        convexAuthLoading ||
        (Boolean(user?._id) && !protectedQueryReady) ||
        (protectedQueryReady && rawZone === undefined);
    const zone = rawZone ? transformZone(rawZone) : null;

    return { zone, loading };
}
