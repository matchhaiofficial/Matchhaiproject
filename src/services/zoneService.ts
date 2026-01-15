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
import type {
  BranchData,
  ZoneStep1Data,
} from "../store/zoneOnboardingStore";
import Logger from "../utils/logger";
import { SkillTier } from "./skillRatingService";
import { normalizePhoneForSave } from "./userService";

// BookingRequest interface for representing incoming booking requests
export interface BookingRequest {
  id: string;
  userId: string;
  userName: string;
  gameKey: string;
  title: string;
  description: string;
  maxPlayers: number;
  format: string;
  selectedMaps: string[];
  skillLevel: string;
  hostSkillScore?: number | null;
  hostSkillTier?: SkillTier | 'Any';
  hostSkillContext?: {
    gameKey: string;
    answers: Record<string, any>;
  };
  teamMode: 'solo' | 'team';
  teamId: string | null;
  reservedSlots: number;

  preferredAreas: string[];
  budgetPerPlayer: number;
  currency: string;
  status: 'pending' | 'fulfilled';
  createdAt: any;
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
      consoleSeats: branches.reduce((sum, b) => sum + (toIntOrNull(b.pricing.console?.ps5?.count) || 0), 0),
      consolePlatform: branches.some(b => b.pricing.console?.ps5) ? 'ps5' : null,

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

      status: "active" as const,
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
 * Fetch booking requests that match the zone's supported games.
 * Only returns requests with status 'pending'.
 */
export async function getBookingRequests(
  supportedGames: string[]
): Promise<{ ok: true; data: BookingRequest[] } | { ok: false; message: string }> {
  try {
    if (!supportedGames || supportedGames.length === 0) {
      return { ok: true, data: [] };
    }

    // Removed orderBy to avoid index issues - sorting in memory instead
    const q = query(
      collection(db, "booking_requests"),
      where("gameKey", "in", supportedGames),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BookingRequest[];

    // Sort in memory by createdAt descending
    requests.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    Logger.info("zoneService", "Fetched booking requests", { count: requests.length });
    return { ok: true, data: requests };
  } catch (error) {
    Logger.error("zoneService", "Error fetching booking requests", error);
    return { ok: false, message: "Failed to fetch booking requests" };
  }
}

/**
 * Create a new booking request.
 */
export async function createBookingRequest(
  requestData: Omit<BookingRequest, 'id' | 'createdAt' | 'status'>
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const docRef = await addDoc(collection(db, "booking_requests"), {
      ...requestData,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    Logger.info("zoneService", "Created booking request", { id: docRef.id });
    return { ok: true, id: docRef.id };
  } catch (error) {
    Logger.error("zoneService", "Error creating booking request", error);
    return { ok: false, message: "Failed to create booking request" };
  }
}

/**
 * Send a booking offer from a zone to a user's booking request.
 */
export async function sendBookingOffer(offer: {
  requestId: string;
  zoneId: string;
  branchId: string;
  zoneName: string;
  branchName: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await addDoc(collection(db, "booking_offers"), {
      ...offer,
      createdAt: serverTimestamp(),
    });

    Logger.info("zoneService", "Sent booking offer", { requestId: offer.requestId });
    return { ok: true };
  } catch (error) {
    Logger.error("zoneService", "Error sending booking offer", error);
    return { ok: false, message: "Failed to send booking offer" };
  }
}

/**
 * Zone interface for displaying zone info
 */
export interface Zone {
  id: string;
  ownerUid: string;
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
    };

    // Sports
    futsal?: { count: number; price: number };
    indoorCricket?: { count: number; price: number };
    padel?: {
      red?: { count: number; price: number };
      blue?: { count: number; price: number };
    };
    pickleball?: { count: number; price: number };
  };

  // Legacy fields (kept optional for backward compat if needed, or remove if strict)
  capacity?: {
    pcSeats: number | null;
    consoleSeats: number | null;
    consolePlatform: string | null;
  };
  hourlyRate?: number;
  ps5HourlyRate?: number;

  status: 'active' | 'pending-review' | 'suspended';
  createdAt: any;
  updatedAt: any;
  onboardingStep: number;
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
    let zones = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Zone[];

    // Filter by game if specified
    if (gameKey) {
      // FC25 and FC26 use the same support flag
      let normalizedGameKey = gameKey === 'fc26' ? 'fc25' : gameKey;

      // Handle snake_case keys like indoor_cricket
      if (normalizedGameKey === 'indoor_cricket') {
        normalizedGameKey = 'indoorCricket';
      }

      const gameField = `supports${normalizedGameKey.charAt(0).toUpperCase() + normalizedGameKey.slice(1)}` as keyof Zone['games'];
      zones = zones.filter(zone => zone.games?.[gameField] === true);

      // Additional filter based on equipment availability
      // CS2 requires PCs
      if (gameKey === 'cs2') {
        zones = zones.filter(zone => {
          const pcSeats = zone.capacity?.pcSeats ?? 0;
          return pcSeats > 0;
        });
      }
      // FC25, FC26, and Tekken8 require consoles (PS5)
      else if (gameKey === 'fc25' || gameKey === 'fc26' || gameKey === 'tekken8') {
        zones = zones.filter(zone => {
          const consoleSeats = zone.capacity?.consoleSeats ?? 0;
          return consoleSeats > 0 && (zone.ps5HourlyRate || 0) > 0;
        });
      }
    }

    Logger.info('zoneService', 'Fetched active zones', { count: zones.length, gameKey });
    return { ok: true, data: zones };
  } catch (error) {
    Logger.error('zoneService', 'Error fetching active zones', error);
    return { ok: false, message: 'Failed to fetch zones' };
  }
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

