import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { Id } from "../../convex/_generated/dataModel";

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
        gamesObj = {
            supportsCs2: zone.games.includes("cs2"),
            supportsCs16: zone.games.includes("cs16"),
            supportsValorant: zone.games.includes("valorant"),
            supportsFc25: zone.games.includes("fc25") || zone.games.includes("fc26"),
            supportsTekken8: zone.games.includes("tekken8"),
            supportsFutsal: zone.games.includes("futsal"),
            supportsIndoorCricket: zone.games.includes("indoor_cricket"),
            supportsPadel: zone.games.includes("padel"),
            supportsPickleball: zone.games.includes("pickleball"),
        };
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
    const { user } = useAuth();

    const rawZone = useQuery(
        api.zones.getByOwner,
        user?._id ? { ownerUid: user._id as Id<"users"> } : "skip",
    );

    const loading = rawZone === undefined;
    const zone = rawZone ? transformZone(rawZone) : null;

    return { zone, loading };
}
