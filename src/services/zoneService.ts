// src/services/zoneService.ts
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import type {
  ZoneStep1Data,
  ZoneStep2Data,
  ZoneStep3Data,
  ZoneBranchLocation,
} from "../store/zoneOnboardingStore";
import { normalizePhoneForSave } from "./userService";

/** Shape we’ll save for a new zone + primary branch */
export interface ZoneRegistrationSteps {
  step1: ZoneStep1Data;
  step2: ZoneStep2Data;
  step3: ZoneStep3Data;
}

function toIntOrNull(value: string): number | null {
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
    const { step1, step2, step3 } = data;

    const zonesRef = collection(db, "zones");

    const normalizedPhone = step1.contactPhone
      ? normalizePhoneForSave(step1.contactPhone)
      : null;

    const allBranches: ZoneBranchLocation[] =
      step2.branches && step2.branches.length > 0
        ? step2.branches
        : [
            {
              branchDisplayName: "",
              city: "",
              areaLabel: "",
              addressLine1: "",
              googleMapsUrl: "",
            },
          ];

    const primaryBranch = allBranches[0];
    const additionalBranches = allBranches.slice(1).map((branch) => ({
      branchDisplayName: branch.branchDisplayName.trim() || null,
      city: branch.city.trim() || null,
      areaLabel: branch.areaLabel.trim() || null,
      addressLine1: branch.addressLine1.trim() || null,
      googleMapsUrl: branch.googleMapsUrl.trim() || null,
    }));

    const docBody = {
      ownerUid: user.uid,
      ownerFullName: step1.ownerFullName.trim(),
      venueBrandName: step1.venueBrandName.trim(),
      contactEmail: step1.contactEmail.trim().toLowerCase(),
      contactPhone: normalizedPhone,

      status: "pending-review" as const,
      onboardingStep: 4,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      primaryBranch: {
        branchDisplayName: primaryBranch?.branchDisplayName.trim() || null,
        city: primaryBranch?.city.trim() || null,
        areaLabel: primaryBranch?.areaLabel.trim() || null,
        addressLine1: primaryBranch?.addressLine1.trim() || null,
        googleMapsUrl: primaryBranch?.googleMapsUrl.trim() || null,
      },

      additionalBranches,

      games: {
        supportsCs2: !!step3.supportsCs2,
        supportsFc25: !!step3.supportsFc25,
        supportsTekken8: !!step3.supportsTekken8,
        supportsFutsal: !!step3.supportsFutsal,
        supportsIndoorCricket: !!step3.supportsIndoorCricket,
        supportsPadel: !!step3.supportsPadel,
        supportsPickleball: !!step3.supportsPickleball,
      },

      capacity: {
        pcSeats: toIntOrNull(step3.pcSeats),
        consoleSeats: toIntOrNull(step3.consoleSeats),
        consolePlatform: step3.consolePlatform || null,

        futsalCourts: toIntOrNull(step3.futsalCourts),
        futsalCourtType: step3.futsalCourtType || null,

        indoorCricketNets: toIntOrNull(step3.indoorCricketNets),
        indoorCricketSurface: step3.indoorCricketSurface || null,

        padelCourts: toIntOrNull(step3.padelCourts),
        padelCourtSurface: step3.padelCourtSurface || null,

        pickleballCourts: toIntOrNull(step3.pickleballCourts),
        pickleballSurface: step3.pickleballSurface || null,
      },

      notes: step3.notes?.trim() || null,
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
