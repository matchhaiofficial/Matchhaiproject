// src/services/zoneService.ts
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import {
  getEnabledPricingRulesForZone,
  resolveEffectiveRateForGame,
} from "./pricingRuleService";
import type {
  BranchData,
  ZoneStep1Data,
} from "../store/zoneOnboardingStore";
import Logger from "../utils/logger";
import { normalizePhoneForSave } from "./userService";

export interface EffectiveRateResult {
  rate: number | null;
  label: string | null;
  source: "root_pricing" | "branch_pricing" | "none";
}

/** Shape we’ll save for a new zone + primary branch */
export interface ZoneRegistrationSteps {
  step1: ZoneStep1Data;
  branches: BranchData[];
}

function toIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Save a new zone document for the currently signed-in user.
 * Assumes auth user already exists (created via signUpWithEmail).
 */
export async function saveZoneRegistration(
  data: ZoneRegistrationSteps
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = auth.currentUser;

  if (!user) {
    return {
      ok: false,
      message: "Not signed in. Please log in again before submitting your zone.",
    };
  }

  try {
    const { step1, branches } = data;
    const primaryBranch = branches[0]; // First branch is primary

    const zonesRef = collection(db, "zones");

    const normalizedPhone = step1.contactPhone
      ? normalizePhoneForSave(step1.contactPhone)
      : null;

    // Aggregate games support across all branches
    const games = {
      supportsCs2: branches.some(b => b.supportsCs2),
      supportsFc25: branches.some(b => b.supportsFc25),
      supportsTekken8: branches.some(b => b.supportsTekken8),
      supportsFutsal: branches.some(b => b.supportsFutsal),
      supportsIndoorCricket: branches.some(b => b.supportsIndoorCricket),
      supportsPadel: branches.some(b => b.supportsPadel),
      supportsPickleball: branches.some(b => b.supportsPickleball),
    };

    // Aggregate capacity (sum of all branches)
    const capacity = {
      pcSeats: branches.reduce((sum, b) => sum + (toIntOrNull(b.pricing.pc?.regular?.count) || 0) + (toIntOrNull(b.pricing.pc?.premium?.count) || 0) + (toIntOrNull(b.pricing.pc?.elite?.count) || 0), 0),
      consoleSeats: branches.reduce((sum, b) => sum + (toIntOrNull(b.pricing.console?.ps5?.count) || 0) + (toIntOrNull(b.pricing.console?.xbox?.count) || 0), 0),
      consolePlatform: branches.some(b => b.pricing.console?.ps5) && branches.some(b => b.pricing.console?.xbox)
        ? 'mixed'
        : (branches.some(b => b.pricing.console?.ps5) ? 'ps5' : (branches.some(b => b.pricing.console?.xbox) ? 'xbox' : null)),

      futsalCourts: branches.reduce((sum, b) => sum + Object.values(b.pricing.futsal || {}).reduce((s, v: any) => s + (toIntOrNull(v.count) || 0), 0), 0),
      futsalCourtType: null, // Legacy

      indoorCricketNets: branches.reduce((sum, b) => sum + Object.values(b.pricing.indoor_cricket || {}).reduce((s, v: any) => s + (toIntOrNull(v.count) || 0), 0), 0),
      indoorCricketSurface: null,

      padelCourts: branches.reduce((sum, b) => sum + Object.values(b.pricing.padel || {}).reduce((s, v: any) => s + (toIntOrNull(v.count) || 0), 0), 0),
      padelCourtSurface: null,

      pickleballCourts: branches.reduce((sum, b) => sum + Object.values(b.pricing.pickleball || {}).reduce((s, v: any) => s + (toIntOrNull(v.count) || 0), 0), 0),
      pickleballSurface: null,
    };

    // Map branches to storage format (convert strings to numbers)
    const mappedBranches = branches.map(b => ({
      id: b.id,
      branchDisplayName: b.branchDisplayName.trim(),
      city: b.city.trim(),
      areaLabel: b.areaLabel.trim(),
      addressLine1: b.addressLine1.trim(),
      googleMapsUrl: b.googleMapsUrl.trim() || null,
      games: {
        supportsCs2: !!b.supportsCs2,
        supportsFc25: !!b.supportsFc25,
        supportsTekken8: !!b.supportsTekken8,
        supportsFutsal: !!b.supportsFutsal,
        supportsIndoorCricket: !!b.supportsIndoorCricket,
        supportsPadel: !!b.supportsPadel,
        supportsPickleball: !!b.supportsPickleball,
      },
      pricing: {
        pc: b.pricing.pc ? {
          regular: b.pricing.pc.regular ? { count: toIntOrNull(b.pricing.pc.regular.count) || 0, price: toIntOrNull(b.pricing.pc.regular.price) || 0 } : null,
          premium: b.pricing.pc.premium ? { count: toIntOrNull(b.pricing.pc.premium.count) || 0, price: toIntOrNull(b.pricing.pc.premium.price) || 0 } : null,
          elite: b.pricing.pc.elite ? { count: toIntOrNull(b.pricing.pc.elite.count) || 0, price: toIntOrNull(b.pricing.pc.elite.price) || 0 } : null,
        } : null,
        console: b.pricing.console ? {
          ps5: b.pricing.console.ps5 ? {
            count: toIntOrNull(b.pricing.console.ps5.count) || 0,
            price1v1: toIntOrNull(b.pricing.console.ps5.price1v1) || 0,
            price2v2: toIntOrNull(b.pricing.console.ps5.price2v2) || 0
          } : null,
          xbox: b.pricing.console.xbox ? {
            count: toIntOrNull(b.pricing.console.xbox.count) || 0,
            price1v1: toIntOrNull(b.pricing.console.xbox.price1v1) || 0,
            price2v2: toIntOrNull(b.pricing.console.xbox.price2v2) || 0
          } : null
        } : null,
        // Sports maps (dynamic keys)
        futsal: b.pricing.futsal ? Object.entries(b.pricing.futsal).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: { count: toIntOrNull(v.count) || 0, price: toIntOrNull(v.price) || 0 } }), {}) : null,
        indoorCricket: b.pricing.indoor_cricket ? Object.entries(b.pricing.indoor_cricket).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: { count: toIntOrNull(v.count) || 0, price: toIntOrNull(v.price) || 0 } }), {}) : null,
        padel: b.pricing.padel ? Object.entries(b.pricing.padel).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: { count: toIntOrNull(v.count) || 0, price: toIntOrNull(v.price) || 0 } }), {}) : null,
        pickleball: b.pricing.pickleball ? Object.entries(b.pricing.pickleball).reduce((acc, [k, v]: [string, any]) => ({ ...acc, [k]: { count: toIntOrNull(v.count) || 0, price: toIntOrNull(v.price) || 0 } }), {}) : null,
      },
      notes: b.notes?.trim() || null,
      specs: b.specs?.trim() || null
    }));

    const docBody = {
      ownerUid: user.uid,
      ownerFullName: step1.ownerFullName.trim(),
      venueBrandName: step1.venueBrandName.trim(),
      contactEmail: step1.contactEmail.trim().toLowerCase(),
      contactPhone: normalizedPhone,
      type: step1.type,

      status: "pending-review" as const,
      onboardingStep: 4,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      // Primary Branch (for display)
      primaryBranch: {
        branchDisplayName: primaryBranch.branchDisplayName.trim(),
        city: primaryBranch.city.trim(),
        areaLabel: primaryBranch.areaLabel.trim(),
        addressLine1: primaryBranch.addressLine1.trim(),
        googleMapsUrl: primaryBranch.googleMapsUrl.trim() || null,
      },

      // All Branches
      branches: mappedBranches,

      // Aggregated for filtering
      games,
      capacity,

      // Legacy pricing (Primary branch's pricing for backward compat)
      pricing: mappedBranches[0].pricing,

      notes: primaryBranch.notes?.trim() || null,
    };

    await addDoc(zonesRef, docBody);

    return { ok: true };
  } catch (e) {
    console.log("[zoneService] saveZoneRegistration error", e);
    return {
      ok: false,
      message: "Could not save your zone. Please try again.",
    };
  }
}

/**
 * Zone interface for displaying zone info
 */
export interface Zone {
  id: string;
  ownerUid: string;
  ownerFullName: string;
  venueBrandName: string;
  contactEmail: string;
  contactPhone: string | null;

  // New field: Business Type
  type: 'gaming' | 'sports' | 'hybrid';

  primaryBranch: {
    branchDisplayName: string | null;
    city: string | null;
    areaLabel: string | null;
    addressLine1: string | null;
    googleMapsUrl: string | null;
  };

  branches: any[]; // Detailed branch structure

  games: {
    supportsCs2: boolean;
    supportsFc25: boolean; // Covers FC25/26
    supportsTekken8: boolean;
    supportsFutsal: boolean;
    supportsIndoorCricket: boolean;
    supportsPadel: boolean;
    supportsPickleball: boolean;
  };

  // Detailed Pricing & Capacity
  pricing: {
    // Gaming
    pc?: {
      regular?: { count: number; price: number };
      premium?: { count: number; price: number };
      elite?: { count: number; price: number };
    };
    console?: {
      ps5?: {
        count: number;
        price1v1: number; // 2 controllers
        price2v2: number; // 4 controllers
      };
      xbox?: {
        count: number;
        price1v1: number;
        price2v2: number;
      };
    };

    // Sports (Maps of category -> { count, price })
    futsal?: Record<string, { count: number; price: number }>;
    indoorCricket?: Record<string, { count: number; price: number }>;
    padel?: Record<string, { count: number; price: number }>;
    pickleball?: Record<string, { count: number; price: number }>;
  };

  // Legacy fields (kept optional for backward compat if needed, or remove if strict)
  capacity?: {
    pcSeats: number | null;
    consoleSeats: number | null;
    consolePlatform: string | null;
  };
  hourlyRate?: number;
  ps5HourlyRate?: number;

  status: 'active' | 'pending-review' | 'suspended' | 'rejected';
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
  onboardingStep: number;

  // Computed fields (for UI)
  effectiveRate?: number | null;
  effectiveRateLabel?: string | null;
  effectiveRateRuleName?: string | null;
}

/**
 * Get active zones that support a specific game and have the required equipment
 */

export async function getActiveZones(
  gameKey?: string
): Promise<{ ok: true; data: Zone[] } | { ok: false; message: string }> {
  try {
    const q = query(
      collection(db, 'zones'),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    let zones = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Zone));

    // Filter by game if specified
    if (gameKey) {
      // FC25 and FC26 use the same support flag
      let normalizedGameKey = gameKey === 'fc26' ? 'fc25' : gameKey;

      // Handle snake_case keys like indoor_cricket
      if (normalizedGameKey === 'indoor_cricket') {
        normalizedGameKey = 'indoorCricket';
      }

      const gameField = `supports${normalizedGameKey.charAt(0).toUpperCase() + normalizedGameKey.slice(1)}` as keyof Zone['games'];
      zones = zones.filter((zone: Zone) => zone.games?.[gameField] === true);

      // Additional filter based on equipment availability
      // CS2 requires PCs
      if (gameKey === 'cs2') {
        zones = zones.filter((zone: Zone) => {
          const pcSeats = zone.capacity?.pcSeats ?? 0;
          return pcSeats > 0;
        });
      }
      // FC25, FC26, and Tekken8 require consoles (PS5)
      else if (gameKey === 'fc25' || gameKey === 'fc26' || gameKey === 'tekken8') {
        zones = zones.filter((zone: Zone) => {
          const consoleSeats = zone.capacity?.consoleSeats ?? 0;
          return consoleSeats > 0; // Removed hourly rate check as we now derive it
        });
      }

      zones = await Promise.all(
        zones.map(async (zoneData: Zone) => {
          const derivation = deriveZoneRate(zoneData, gameKey);
          const rules = await getEnabledPricingRulesForZone(zoneData.id);
          const branchId = zoneData.branches?.[0]?.id || null;
          const resolved = resolveEffectiveRateForGame({
            gameKey,
            baseRate: derivation.rate,
            baseLabel: derivation.label,
            rules,
            branchId,
            at: new Date(),
          });

          zoneData.effectiveRate = resolved.rate ?? derivation.rate;
          zoneData.effectiveRateLabel = resolved.label ?? derivation.label;
          zoneData.effectiveRateRuleName = resolved.appliedRule?.name || null;

          // Legacy compatibility
          if (gameKey === 'fc26' || gameKey === 'fc25' || gameKey === 'tekken8') {
            zoneData.ps5HourlyRate = zoneData.effectiveRate || undefined;
            zoneData.hourlyRate = undefined;
          } else {
            zoneData.hourlyRate = zoneData.effectiveRate || undefined;
            zoneData.ps5HourlyRate = undefined;
          }
          return zoneData;
        })
      );
    }

    Logger.info('zoneService', 'Fetched active zones', { count: zones.length, gameKey });
    return { ok: true, data: zones };
  } catch (error) {
    Logger.error('zoneService', 'Error fetching active zones', error);
    return { ok: false, message: 'Failed to fetch zones' };
  }
}

/**
 * Derives an effective rate for a specific game within a zone.
 * Prefers branch pricing over root pricing.
 */
export function deriveZoneRate(zone: Zone, gameKey: string): EffectiveRateResult {
  const branchPricing = zone.branches?.[0]?.pricing;
  const rootPricing = zone.pricing;

  const p = branchPricing || rootPricing;
  const source: EffectiveRateResult['source'] = branchPricing ? "branch_pricing" : (rootPricing ? "root_pricing" : "none");

  if (!p) return { rate: null, label: null, source: "none" };

  let rate: number | null = null;
  let label: string | null = null;

  switch (gameKey) {
    case 'cs2':
      rate = p.pc?.regular?.price || p.pc?.premium?.price || p.pc?.elite?.price || null;
      if (rate) label = `${rate} PKR/hr (Regular)`;
      break;

    case 'fc26':
    case 'fc25':
    case 'tekken8':
      // Prefer price1v1, fallback to price2v2 or any other field starting with 'price'
      const consolePs5 = p.console?.ps5 as any;
      const consoleXbox = p.console?.xbox as any;
      const ps5Rate = consolePs5?.price1v1 || consolePs5?.price || consolePs5?.price2v2 || null;
      const xboxRate = consoleXbox?.price1v1 || consoleXbox?.price || consoleXbox?.price2v2 || null;
      rate = ps5Rate || xboxRate || null;
      if (rate) label = `${rate} PKR/hr (${ps5Rate ? 'PS5' : 'Xbox'})`;
      break;

    case 'futsal':
      const futsal = p.futsal;
      if (futsal) {
        const keys = Object.keys(futsal);
        if (keys.length > 0) {
          const key = futsal["5v5"] ? "5v5" : keys[0]; // Prefer 5v5
          rate = futsal[key]?.price || null;
          if (rate) label = `${rate} PKR/hr (${key})`;
        }
      }
      break;

    case 'indoor_cricket':
      const ic = (p as any).indoorCricket || p.indoor_cricket;
      if (ic) {
        const firstKey = Object.keys(ic)[0];
        rate = ic[firstKey]?.price || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case 'padel':
      const padel = p.padel;
      if (padel) {
        const firstKey = Object.keys(padel)[0];
        rate = padel[firstKey]?.price || null;
        if (rate) label = `${rate} PKR/hr (${firstKey})`;
      }
      break;

    case 'pickleball':
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
 * Update a zone document by ID with partial data.
 */
export async function updateZone(
  zoneId: string,
  data: Partial<any>
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const zoneRef = doc(db, 'zones', zoneId);
    await updateDoc(zoneRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
    Logger.info('zoneService', 'Updated zone', { zoneId });
    return { ok: true };
  } catch (error) {
    Logger.error('zoneService', 'Error updating zone', error);
    return { ok: false, message: 'Failed to update zone' };
  }
}

/**
 * Add a new branch to an existing zone.
 */
export async function addBranch(
  zoneId: string,
  branch: any
): Promise<{ ok: true; id?: string } | { ok: false; message: string }> {
  try {
    const zoneRef = doc(db, 'zones', zoneId);
    // Note: This logic assumes branches are stored in an array in the zone doc
    // Based on saveZoneRegistration, it is 'branches'
    await updateDoc(zoneRef, {
      branches: arrayUnion({
        ...branch,
        id: branch.id || Math.random().toString(36).substring(7),
      }),
      updatedAt: serverTimestamp(),
    });
    Logger.info('zoneService', 'Added branch to zone', { zoneId });
    return { ok: true };
  } catch (error) {
    Logger.error('zoneService', 'Error adding branch', error);
    return { ok: false, message: 'Failed to add branch' };
  }
}

