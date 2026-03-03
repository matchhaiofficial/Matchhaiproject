// src/services/convex/zoneService.ts
// Convex-based zone service that maintains the same interface as the Firebase version

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export interface EffectiveRateResult {
  rate: number | null;
  label: string | null;
  source: "root_pricing" | "branch_pricing" | "none";
}

export interface Zone {
  id: string;
  _id?: string;
  ownerUid: string;
  ownerFullName?: string;
  venueBrandName: string;
  contactEmail?: string;
  contactPhone?: string | null;

  // Business Type
  type?: "gaming" | "sports" | "hybrid";

  primaryBranch?: {
    branchDisplayName?: string | null;
    city?: string | null;
    areaLabel?: string | null;
    addressLine1?: string | null;
    googleMapsUrl?: string | null;
  };

  branches?: any[];

  games?: {
    supportsCs2?: boolean;
    supportsFc25?: boolean;
    supportsTekken8?: boolean;
    supportsFutsal?: boolean;
    supportsIndoorCricket?: boolean;
    supportsPadel?: boolean;
    supportsPickleball?: boolean;
  };

  // Detailed Pricing & Capacity
  pricing?: {
    pc?: {
      regular?: { count: number; price: number };
      premium?: { count: number; price: number };
      elite?: { count: number; price: number };
    };
    console?: {
      ps5?: {
        count: number;
        price1v1: number;
        price2v2: number;
      };
      xbox?: {
        count: number;
        price1v1: number;
        price2v2: number;
      };
    };
    futsal?: Record<string, { count: number; price: number }>;
    indoorCricket?: Record<string, { count: number; price: number }>;
    padel?: Record<string, { count: number; price: number }>;
    pickleball?: Record<string, { count: number; price: number }>;
  };

  capacity?: {
    pcSeats?: number | null;
    consoleSeats?: number | null;
    consolePlatform?: string | null;
    futsalCourts?: number;
    indoorCricketNets?: number;
    padelCourts?: number;
    pickleballCourts?: number;
  };

  hourlyRate?: number;
  ps5HourlyRate?: number;

  status: "active" | "pending-review" | "suspended" | "rejected";
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
  onboardingStep?: number;

  // Computed fields (for UI)
  effectiveRate?: number | null;
  effectiveRateLabel?: string | null;
  effectiveRateRuleName?: string | null;
}

type SuccessResult<T> = { ok: true; data?: T; message?: string };
type ErrorResult = { ok: false; message: string };
type Result<T = void> = SuccessResult<T> | ErrorResult;

/**
 * Transform Convex zone to Firebase-compatible Zone interface
 */
function transformZone(zone: any): Zone {
  // Handle games array vs object format
  let gamesObj = zone.games;
  if (Array.isArray(zone.games)) {
    gamesObj = {
      supportsCs2: zone.games.includes("cs2"),
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
    ownerFullName: zone.ownerFullName || zone.ownerUsername,
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
  };
}

/**
 * Derives an effective rate for a specific game within a zone.
 */
export function deriveZoneRate(zone: Zone, gameKey: string): EffectiveRateResult {
  const branchPricing = zone.branches?.[0]?.pricing;
  const rootPricing = zone.pricing;

  const p = branchPricing || rootPricing;
  const source: EffectiveRateResult["source"] = branchPricing
    ? "branch_pricing"
    : rootPricing
      ? "root_pricing"
      : "none";

  if (!p) return { rate: null, label: null, source: "none" };

  let rate: number | null = null;
  let label: string | null = null;

  switch (gameKey) {
    case "cs2":
      rate =
        p.pc?.regular?.price || p.pc?.premium?.price || p.pc?.elite?.price || null;
      if (rate) label = `${rate} PKR/hr (Regular)`;
      break;

    case "fc26":
    case "fc25":
    case "tekken8":
      const consolePs5 = p.console?.ps5 as any;
      const consoleXbox = p.console?.xbox as any;
      const ps5Rate =
        consolePs5?.price1v1 || consolePs5?.price || consolePs5?.price2v2 || null;
      const xboxRate =
        consoleXbox?.price1v1 || consoleXbox?.price || consoleXbox?.price2v2 || null;
      rate = ps5Rate || xboxRate || null;
      if (rate) label = `${rate} PKR/hr (${ps5Rate ? "PS5" : "Xbox"})`;
      break;

    case "futsal":
      const futsal = p.futsal;
      if (futsal) {
        const keys = Object.keys(futsal);
        if (keys.length > 0) {
          const key = futsal["5v5"] ? "5v5" : keys[0];
          rate = futsal[key]?.price || null;
          if (rate) label = `${rate} PKR/hr (${key})`;
        }
      }
      break;

    case "indoor_cricket":
      const ic = (p as any).indoorCricket || p.indoor_cricket;
      if (ic) {
        const firstKey = Object.keys(ic)[0];
        rate = ic[firstKey]?.price || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case "padel":
      const padel = p.padel;
      if (padel) {
        const firstKey = Object.keys(padel)[0];
        rate = padel[firstKey]?.price || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case "pickleball":
      const pickle = p.pickleball;
      if (pickle) {
        const firstKey = Object.keys(pickle)[0];
        rate = pickle[firstKey]?.price || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;
  }

  return { rate, label, source };
}

/**
 * Get active zones, optionally filtered by game
 */
export async function getActiveZones(
  gameKey?: string
): Promise<Result<Zone[]>> {
  try {
    const rawZones = await convex.query(api.zones.listActive, { limit: 100 });
    let zones = rawZones.map(transformZone);

    // Filter by game if specified
    if (gameKey) {
      let normalizedGameKey = gameKey === "fc26" ? "fc25" : gameKey;
      if (normalizedGameKey === "indoor_cricket") {
        normalizedGameKey = "indoorCricket";
      }

      const gameField =
        `supports${normalizedGameKey.charAt(0).toUpperCase() + normalizedGameKey.slice(1)}` as keyof Zone["games"];
      zones = zones.filter((zone) => zone.games?.[gameField] === true);

      // Additional filter based on equipment availability
      if (gameKey === "cs2") {
        zones = zones.filter((zone) => {
          const pcSeats = zone.capacity?.pcSeats ?? 0;
          return pcSeats > 0;
        });
      } else if (gameKey === "fc25" || gameKey === "fc26" || gameKey === "tekken8") {
        zones = zones.filter((zone) => {
          const consoleSeats = zone.capacity?.consoleSeats ?? 0;
          return consoleSeats > 0;
        });
      }

      // Compute effective rates
      zones = zones.map((zone) => {
        const derivation = deriveZoneRate(zone, gameKey);
        zone.effectiveRate = derivation.rate;
        zone.effectiveRateLabel = derivation.label;

        // Legacy compatibility
        if (gameKey === "fc26" || gameKey === "fc25" || gameKey === "tekken8") {
          zone.ps5HourlyRate = zone.effectiveRate || undefined;
          zone.hourlyRate = undefined;
        } else {
          zone.hourlyRate = zone.effectiveRate || undefined;
          zone.ps5HourlyRate = undefined;
        }
        return zone;
      });
    }

    return { ok: true, data: zones };
  } catch (error: any) {
    console.error("[zoneService] getActiveZones error:", error);
    return { ok: false, message: "Failed to fetch zones" };
  }
}

/**
 * Get zone by ID
 */
export async function getZoneById(zoneId: string): Promise<Result<Zone>> {
  try {
    const zone = await convex.query(api.zones.getById, {
      zoneId: zoneId as Id<"zones">,
    });
    if (!zone) {
      return { ok: false, message: "Zone not found" };
    }
    return { ok: true, data: transformZone(zone) };
  } catch (error: any) {
    console.error("[zoneService] getZoneById error:", error);
    return { ok: false, message: "Failed to fetch zone" };
  }
}

/**
 * Get zone by owner UID
 */
export async function getZoneByOwner(ownerUid: string): Promise<Result<Zone>> {
  try {
    // First get the Convex user ID from auth ID
    const user = await convex.query(api.users.getByAuthId, { authId: ownerUid });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    const zone = await convex.query(api.zones.getByOwner, {
      ownerUid: user._id,
    });
    if (!zone) {
      return { ok: false, message: "Zone not found" };
    }
    return { ok: true, data: transformZone(zone) };
  } catch (error: any) {
    console.error("[zoneService] getZoneByOwner error:", error);
    return { ok: false, message: "Failed to fetch zone" };
  }
}

/**
 * Update a zone
 */
export async function updateZone(
  zoneId: string,
  data: Partial<any>
): Promise<Result> {
  try {
    await convex.mutation(api.zones.update, {
      zoneId: zoneId as Id<"zones">,
      ...data,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] updateZone error:", error);
    return { ok: false, message: "Failed to update zone" };
  }
}

/**
 * Add a branch to a zone
 */
export async function addBranch(
  zoneId: string,
  branch: any
): Promise<Result<{ id: string }>> {
  try {
    const zone = await convex.query(api.zones.getById, {
      zoneId: zoneId as Id<"zones">,
    });
    if (!zone) {
      return { ok: false, message: "Zone not found" };
    }

    const newBranch = {
      ...branch,
      id: branch.id || Math.random().toString(36).substring(7),
    };

    const updatedBranches = [...(zone.branches || []), newBranch];

    await convex.mutation(api.zones.update, {
      zoneId: zoneId as Id<"zones">,
      branches: updatedBranches,
    });

    return { ok: true, data: { id: newBranch.id } };
  } catch (error: any) {
    console.error("[zoneService] addBranch error:", error);
    return { ok: false, message: "Failed to add branch" };
  }
}

/**
 * Save zone registration (for new zones)
 */
export async function saveZoneRegistration(data: {
  step1: any;
  branches: any[];
}): Promise<Result> {
  try {
    const { step1, branches } = data;
    const primaryBranch = branches[0];

    // Get current user
    const { authClient } = await import("../../lib/auth-client");
    const session = await authClient.getSession();
    if (!session?.data?.user) {
      return { ok: false, message: "Not signed in" };
    }

    // Get Convex user
    const user = await convex.query(api.users.getByAuthId, {
      authId: session.data.user.id,
    });
    if (!user) {
      return { ok: false, message: "User not found" };
    }

    // Create games object
    const games = {
      supportsCs2: branches.some((b) => b.supportsCs2),
      supportsFc25: branches.some((b) => b.supportsFc25),
      supportsTekken8: branches.some((b) => b.supportsTekken8),
      supportsFutsal: branches.some((b) => b.supportsFutsal),
      supportsIndoorCricket: branches.some((b) => b.supportsIndoorCricket),
      supportsPadel: branches.some((b) => b.supportsPadel),
      supportsPickleball: branches.some((b) => b.supportsPickleball),
    };

    // Convert games object to array for Convex
    const gamesArray = Object.entries(games)
      .filter(([_, supported]) => supported)
      .map(([key]) => key.replace("supports", "").toLowerCase());

    await convex.mutation(api.zones.create, {
      ownerUid: user._id,
      ownerUsername: user.username,
      name: step1.venueBrandName,
      description: step1.description,
      city: primaryBranch?.city,
      phone: step1.contactPhone,
      games: gamesArray,
      branches: branches.map((b) => ({
        id: b.id || Math.random().toString(36).substring(7),
        name: b.branchDisplayName || b.name,
        address: b.addressLine1 || b.address,
        isActive: true,
      })),
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] saveZoneRegistration error:", error);
    return { ok: false, message: "Could not save your zone. Please try again." };
  }
}

/**
 * List pending review zones (for super admin)
 */
export async function getPendingReviewZones(): Promise<Result<Zone[]>> {
  try {
    const rawZones = await convex.query(api.zones.listPendingReview, {});
    const zones = rawZones.map(transformZone);
    return { ok: true, data: zones };
  } catch (error: any) {
    console.error("[zoneService] getPendingReviewZones error:", error);
    return { ok: false, message: "Failed to fetch pending zones" };
  }
}

/**
 * Approve a zone
 */
export async function approveZone(zoneId: string): Promise<Result> {
  try {
    await convex.mutation(api.zones.approve, {
      zoneId: zoneId as Id<"zones">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] approveZone error:", error);
    return { ok: false, message: "Failed to approve zone" };
  }
}

/**
 * Reject a zone
 */
export async function rejectZone(
  zoneId: string,
  reason?: string
): Promise<Result> {
  try {
    await convex.mutation(api.zones.reject, {
      zoneId: zoneId as Id<"zones">,
      rejectionReason: reason,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] rejectZone error:", error);
    return { ok: false, message: "Failed to reject zone" };
  }
}

/**
 * Suspend a zone
 */
export async function suspendZone(zoneId: string): Promise<Result> {
  try {
    await convex.mutation(api.zones.suspend, {
      zoneId: zoneId as Id<"zones">,
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[zoneService] suspendZone error:", error);
    return { ok: false, message: "Failed to suspend zone" };
  }
}
